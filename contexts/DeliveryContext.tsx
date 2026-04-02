import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { showLocalNotification } from '@/services/notifications';
import { playNewOrderAlert } from '@/services/soundService';

export interface Pedido {
  id: string;
  restaurante_nome: string;
  restaurante_id: string;
  cliente_nome: string;
  endereco_coleta: string;
  endereco_entrega: string;
  valor_entrega: number;
  distancia: string;
  tempo_estimado: string;
  status: 'disponivel' | 'em_andamento' | 'coletado' | 'a_caminho' | 'entregue';
  entregador_id?: string;
  data: string;
  latitude_coleta?: number;
  longitude_coleta?: number;
  latitude_entrega?: number;
  longitude_entrega?: number;
  payment_method?: string;
  notes?: string;
}

export interface HistoricoEntrega {
  id: string;
  restaurante_nome: string;
  data: string;
  valor: number;
  distancia: string;
  status: 'entregue';
}

type DeliveryStatus = 'indo_buscar' | 'coletado' | 'a_caminho' | 'entregue';

interface DeliveryContextType {
  pedidosDisponiveis: Pedido[];
  pedidoAtivo: Pedido | null;
  deliveryStatus: DeliveryStatus;
  historico: HistoricoEntrega[];
  ganhosDia: number;
  ganhosSemana: number;
  isLoadingOrders: boolean;
  aceitarPedido: (pedidoId: string) => Promise<void>;
  recusarPedido: (pedidoId: string) => void;
  avancarStatus: () => void;
  finalizarEntrega: () => Promise<void>;
  refreshOrders: () => Promise<void>;
}

export const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

const APP_STATUS_MAP: Record<string, string> = {
  pending: 'disponivel',
  preparing: 'em_andamento',
  ready: 'coletado',
  delivering: 'a_caminho',
  delivered: 'entregue',
};

// Geocode an address string → lat/lng using OpenStreetMap Nominatim (free, no key)
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (!address || address === 'Endereco de entrega') return null;
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'UPRiderApp/1.0' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    }
  } catch (_) {}
  return null;
}

// Map a raw DB order row to our Pedido interface
async function mapOrderToPedido(o: any, idx: number): Promise<Pedido> {
  const restaurantLat = o.restaurants?.latitude ? Number(o.restaurants.latitude) : undefined;
  const restaurantLng = o.restaurants?.longitude ? Number(o.restaurants.longitude) : undefined;

  // Try to geocode delivery address if no coords stored
  let deliveryLat: number | undefined;
  let deliveryLng: number | undefined;

  const deliveryAddr: string = o.delivery_address || '';
  if (deliveryAddr && deliveryAddr.length > 5) {
    const geo = await geocodeAddress(deliveryAddr);
    if (geo) {
      deliveryLat = geo.latitude;
      deliveryLng = geo.longitude;
    }
  }

  // Fallback: offset from restaurant if geocode failed
  if (!deliveryLat && restaurantLat) {
    deliveryLat = restaurantLat - 0.012 + idx * 0.003;
    deliveryLng = (restaurantLng ?? 0) + 0.015 + idx * 0.004;
  }

  // Calculate distance if both coords available
  let distStr = `${(1.5 + idx * 0.8).toFixed(1).replace('.', ',')} km`;
  if (restaurantLat && restaurantLng && deliveryLat && deliveryLng) {
    const R = 6371;
    const dLat = ((deliveryLat - restaurantLat) * Math.PI) / 180;
    const dLon = ((deliveryLng - restaurantLng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((restaurantLat * Math.PI) / 180) * Math.cos((deliveryLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1).replace('.', ',')} km`;
  }

  const distNum = parseFloat(distStr.replace(',', '.').replace(' km', '').replace(' m', '')) || 2;
  const timeMin = Math.max(10, Math.round(distNum * 4));

  return {
    id: o.id,
    restaurante_nome: o.restaurants?.name || 'Restaurante',
    restaurante_id: o.restaurant_id,
    cliente_nome: 'Cliente',
    endereco_coleta: o.restaurants?.address || 'Endereco do restaurante',
    endereco_entrega: o.delivery_address || 'Endereco de entrega',
    valor_entrega: Number(o.delivery_fee) || Number(o.total) * 0.15 || 8.50,
    distancia: distStr,
    tempo_estimado: `${timeMin} min`,
    status: 'disponivel',
    data: o.created_at,
    latitude_coleta: restaurantLat,
    longitude_coleta: restaurantLng,
    latitude_entrega: deliveryLat,
    longitude_entrega: deliveryLng,
    payment_method: o.payment_method,
    notes: o.notes,
  };
}

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { entregador } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidoAtivo, setPedidoAtivo] = useState<Pedido | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('indo_buscar');
  const [historico, setHistorico] = useState<HistoricoEntrega[]>([]);
  const [ganhosDia, setGanhosDia] = useState(0);
  const [ganhosSemana, setGanhosSemana] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const knownOrderIds = useRef<Set<string>>(new Set());

  const pedidosDisponiveis = pedidos.filter(p => p.status === 'disponivel');

  const fetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      // Fetch available orders
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          client_id,
          restaurant_id,
          driver_id,
          status,
          total,
          delivery_fee,
          delivery_address,
          payment_method,
          notes,
          created_at,
          restaurants (
            name,
            address,
            latitude,
            longitude
          )
        `)
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Erro ao buscar pedidos:', error);
      } else {
        // Map orders (with geocoding for delivery addresses)
        const mapped: Pedido[] = await Promise.all(
          (ordersData || []).map((o: any, idx: number) => mapOrderToPedido(o, idx))
        );
        setPedidos(mapped);

        // Notify about genuinely new orders
        if (knownOrderIds.current.size > 0) {
          const newOnes = mapped.filter(p => !knownOrderIds.current.has(p.id));
          if (newOnes.length > 0) {
            playNewOrderAlert();
            showLocalNotification(
              'Novo pedido disponivel!',
              `${newOnes[0].restaurante_nome} — R$ ${newOnes[0].valor_entrega.toFixed(2).replace('.', ',')} — ${newOnes[0].distancia}`
            );
          }
        }
        knownOrderIds.current = new Set(mapped.map(p => p.id));
      }

      // Fetch active order for this driver
      if (entregador?.user_id) {
        const { data: activeOrder } = await supabase
          .from('orders')
          .select(`
            id,
            client_id,
            restaurant_id,
            driver_id,
            status,
            total,
            delivery_fee,
            delivery_address,
            payment_method,
            notes,
            created_at,
            restaurants (
              name,
              address,
              latitude,
              longitude
            )
          `)
          .eq('driver_id', entregador.user_id)
          .in('status', ['preparing', 'ready', 'delivering'])
          .maybeSingle();

        if (activeOrder) {
          const mapped = await mapOrderToPedido(activeOrder, 0);
          mapped.status = 'em_andamento';
          mapped.entregador_id = entregador.user_id;
          setPedidoAtivo(mapped);

          const statusMapping: Record<string, DeliveryStatus> = {
            preparing: 'indo_buscar',
            ready: 'coletado',
            delivering: 'a_caminho',
          };
          setDeliveryStatus(statusMapping[activeOrder.status] || 'indo_buscar');
        } else {
          setPedidoAtivo(null);
        }
      }
    } finally {
      setIsLoadingOrders(false);
    }
  }, [entregador?.user_id]);

  const fetchHistorico = useCallback(async () => {
    if (!entregador?.user_id) return;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        total,
        delivery_fee,
        created_at,
        restaurants (name)
      `)
      .eq('driver_id', entregador.user_id)
      .eq('status', 'delivered')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      const hist: HistoricoEntrega[] = data.map((o: any) => ({
        id: o.id,
        restaurante_nome: o.restaurants?.name || 'Restaurante',
        data: o.created_at.split('T')[0],
        valor: Number(o.delivery_fee) || Number(o.total) * 0.15 || 8.50,
        distancia: '2,5 km',
        status: 'entregue',
      }));
      setHistorico(hist);

      const today = new Date().toISOString().split('T')[0];
      setGanhosDia(hist.filter(h => h.data === today).reduce((s, h) => s + h.valor, 0));
      setGanhosSemana(hist.reduce((s, h) => s + h.valor, 0));
    }
  }, [entregador?.user_id]);

  useEffect(() => {
    if (entregador?.user_id) {
      fetchOrders();
      fetchHistorico();
    }
  }, [entregador?.user_id]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
        fetchHistorico();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders, fetchHistorico]);

  const aceitarPedido = async (pedidoId: string) => {
    if (!entregador?.user_id) return;
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    const { error } = await supabase
      .from('orders')
      .update({
        driver_id: entregador.user_id,
        status: 'preparing',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', pedidoId);

    if (error) {
      console.error('Erro ao aceitar pedido:', error);
      return;
    }

    setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    setPedidoAtivo({ ...pedido, status: 'em_andamento', entregador_id: entregador.user_id });
    setDeliveryStatus('indo_buscar');
  };

  const recusarPedido = (pedidoId: string) => {
    setPedidos(prev => prev.filter(p => p.id !== pedidoId));
  };

  const avancarStatus = async () => {
    if (!pedidoAtivo || !entregador?.user_id) return;

    const nextMap: Record<string, { delivery: DeliveryStatus; db: string }> = {
      indo_buscar: { delivery: 'coletado', db: 'ready' },
      coletado: { delivery: 'a_caminho', db: 'delivering' },
    };

    const next = nextMap[deliveryStatus];
    if (!next) return;

    setDeliveryStatus(next.delivery);
    await supabase.from('orders').update({ status: next.db }).eq('id', pedidoAtivo.id);
  };

  const finalizarEntrega = async () => {
    if (!pedidoAtivo || !entregador?.user_id) return;

    await supabase.from('orders').update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    }).eq('id', pedidoAtivo.id);

    const entry: HistoricoEntrega = {
      id: pedidoAtivo.id,
      restaurante_nome: pedidoAtivo.restaurante_nome,
      data: new Date().toISOString().split('T')[0],
      valor: pedidoAtivo.valor_entrega,
      distancia: pedidoAtivo.distancia,
      status: 'entregue',
    };

    setHistorico(prev => [entry, ...prev]);
    setGanhosDia(prev => prev + pedidoAtivo.valor_entrega);
    setGanhosSemana(prev => prev + pedidoAtivo.valor_entrega);
    setPedidoAtivo(null);
    setDeliveryStatus('indo_buscar');
  };

  const refreshOrders = async () => { await fetchOrders(); };

  return (
    <DeliveryContext.Provider value={{
      pedidosDisponiveis,
      pedidoAtivo,
      deliveryStatus,
      historico,
      ganhosDia,
      ganhosSemana,
      isLoadingOrders,
      aceitarPedido,
      recusarPedido,
      avancarStatus,
      finalizarEntrega,
      refreshOrders,
    }}>
      {children}
    </DeliveryContext.Provider>
  );
}
