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
      // Fetch available orders (pending, no driver assigned)
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar pedidos:', error);
      } else {
        const mapped: Pedido[] = (ordersData || []).map((o: any, idx: number) => ({
          id: o.id,
          restaurante_nome: o.restaurants?.name || 'Restaurante',
          restaurante_id: o.restaurant_id,
          cliente_nome: 'Cliente',
          endereco_coleta: o.restaurants?.address || 'Endereco do restaurante',
          endereco_entrega: 'Endereco de entrega',
          valor_entrega: Number(o.delivery_fee) || Number(o.total) * 0.15 || 8.50,
          distancia: `${(1.5 + idx * 0.8).toFixed(1).replace('.', ',')} km`,
          tempo_estimado: `${15 + idx * 5} min`,
          status: 'disponivel',
          data: o.created_at,
          latitude_coleta: o.restaurants?.latitude ? Number(o.restaurants.latitude) : undefined,
          longitude_coleta: o.restaurants?.longitude ? Number(o.restaurants.longitude) : undefined,
        }));
        setPedidos(mapped);

        // Notify about genuinely new orders (after first load)
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
          const appStatus = APP_STATUS_MAP[activeOrder.status] || 'em_andamento';
          setPedidoAtivo({
            id: activeOrder.id,
            restaurante_nome: (activeOrder as any).restaurants?.name || 'Restaurante',
            restaurante_id: activeOrder.restaurant_id,
            cliente_nome: 'Cliente',
            endereco_coleta: (activeOrder as any).restaurants?.address || 'Endereco do restaurante',
            endereco_entrega: 'Endereco de entrega',
            valor_entrega: Number((activeOrder as any).delivery_fee) || Number((activeOrder as any).total) * 0.15 || 8.50,
            distancia: '2,5 km',
            tempo_estimado: '20 min',
            status: appStatus as Pedido['status'],
            entregador_id: entregador.user_id,
            data: activeOrder.created_at,
            latitude_coleta: (activeOrder as any).restaurants?.latitude ? Number((activeOrder as any).restaurants.latitude) : undefined,
            longitude_coleta: (activeOrder as any).restaurants?.longitude ? Number((activeOrder as any).restaurants.longitude) : undefined,
          });
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
      const todayEarnings = hist
        .filter(h => h.data === today)
        .reduce((sum, h) => sum + h.valor, 0);
      const weekEarnings = hist.reduce((sum, h) => sum + h.valor, 0);
      setGanhosDia(todayEarnings);
      setGanhosSemana(weekEarnings);
    }
  }, [entregador?.user_id]);

  // Load on mount and when entregador changes
  useEffect(() => {
    if (entregador?.user_id) {
      fetchOrders();
      fetchHistorico();
    }
  }, [entregador?.user_id]);

  // Real-time subscription for orders
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
          fetchHistorico();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    const nextStatus = {
      indo_buscar: { delivery: 'coletado' as DeliveryStatus, db: 'ready' },
      coletado: { delivery: 'a_caminho' as DeliveryStatus, db: 'delivering' },
    } as Record<string, { delivery: DeliveryStatus; db: string }>;

    const next = nextStatus[deliveryStatus];
    if (!next) return;

    setDeliveryStatus(next.delivery);

    await supabase
      .from('orders')
      .update({ status: next.db })
      .eq('id', pedidoAtivo.id);
  };

  const finalizarEntrega = async () => {
    if (!pedidoAtivo || !entregador?.user_id) return;

    await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', pedidoAtivo.id);

    const novoHistorico: HistoricoEntrega = {
      id: pedidoAtivo.id,
      restaurante_nome: pedidoAtivo.restaurante_nome,
      data: new Date().toISOString().split('T')[0],
      valor: pedidoAtivo.valor_entrega,
      distancia: pedidoAtivo.distancia,
      status: 'entregue',
    };

    setHistorico(prev => [novoHistorico, ...prev]);
    setGanhosDia(prev => prev + pedidoAtivo.valor_entrega);
    setGanhosSemana(prev => prev + pedidoAtivo.valor_entrega);
    setPedidoAtivo(null);
    setDeliveryStatus('indo_buscar');
  };

  const refreshOrders = async () => {
    await fetchOrders();
  };

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
