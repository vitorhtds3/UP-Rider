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
  pedidoAtual: Pedido | null;
  totalDisponiveis: number;
  pedidoAtivo: Pedido | null;
  deliveryStatus: DeliveryStatus;
  historico: HistoricoEntrega[];
  ganhosDia: number;
  ganhosSemana: number;
  entregasHoje: number;
  isLoadingOrders: boolean;
  aceitarPedido: (pedidoId: string) => Promise<boolean>;
  recusarPedido: (pedidoId: string) => void;
  avancarStatus: () => void;
  finalizarEntrega: () => Promise<boolean>;
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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function mapOrder(o: any, idx = 0): Pedido {
  const latColeta = o.restaurants?.latitude ? Number(o.restaurants.latitude) : undefined;
  const lngColeta = o.restaurants?.longitude ? Number(o.restaurants.longitude) : undefined;
  const latEntrega = Number(o.latitude_delivery ?? o.delivery_latitude ?? o.lat_entrega ?? 0) || undefined;
  const lngEntrega = Number(o.longitude_delivery ?? o.delivery_longitude ?? o.lon_entrega ?? 0) || undefined;

  let distancia = `${(1.5 + idx * 0.8).toFixed(1).replace('.', ',')} km`;
  if (latColeta && lngColeta && latEntrega && lngEntrega) {
    distancia = formatDistancia(haversineKm(latColeta, lngColeta, latEntrega, lngEntrega));
  }

  return {
    id: o.id,
    restaurante_nome: o.restaurants?.name || 'Restaurante',
    restaurante_id: o.restaurant_id,
    cliente_nome: o.client_name || o.customer_name || o.nome_cliente || 'Cliente',
    endereco_coleta: o.restaurants?.address || 'Endereco do restaurante',
    endereco_entrega: o.delivery_address || o.address_delivery || o.endereco_entrega || 'Endereco de entrega',
    valor_entrega: Number(o.delivery_fee) || Number(o.total) * 0.15 || 8.50,
    distancia,
    tempo_estimado: `${15 + idx * 5} min`,
    status: 'disponivel',
    data: o.created_at,
    latitude_coleta: latColeta,
    longitude_coleta: lngColeta,
    latitude_entrega: latEntrega,
    longitude_entrega: lngEntrega,
  };
}

// How long (ms) before a refused order cycles back into the queue
const RECYCLE_DELAY_MS = 45_000;
// How long (ms) before re-fetching when we have 0 orders (polling fallback)
const EMPTY_POLL_MS = 20_000;

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { entregador } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidoAtivo, setPedidoAtivo] = useState<Pedido | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('indo_buscar');
  const [historico, setHistorico] = useState<HistoricoEntrega[]>([]);
  const [ganhosDia, setGanhosDia] = useState(0);
  const [ganhosSemana, setGanhosSemana] = useState(0);
  const [entregasHoje, setEntregasHoje] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // The single current order exposed to the UI (first in queue)
  const pedidoAtual = pedidos.length > 0 ? pedidos[0] : null;
  const totalDisponiveis = pedidos.length;

  // Track the last order ID we played sound for — avoid duplicate alerts
  const lastAlertedOrderId = useRef<string | null>(null);
  const emptyPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!entregador?.user_id) return;
    setIsLoadingOrders(true);
    try {
      // 1. Try SECURITY DEFINER RPC — bypasses RLS and any status mismatch
      let ordersData: any[] | null = null;
      const { data: rpcOrders, error: rpcErr } = await supabase.rpc('get_available_orders');
      if (!rpcErr && Array.isArray(rpcOrders)) {
        ordersData = rpcOrders;
        console.log('[Delivery] RPC get_available_orders:', rpcOrders.length,
          rpcOrders.map((o: any) => `id=${o.id} status=${o.status}`));
      } else {
        // 2. Fallback: direct query with broad status filter
        if (rpcErr) console.warn('[Delivery] RPC get_available_orders falhou:', rpcErr.message);
        const { data: direct, error: directErr } = await supabase
          .from('orders')
          .select('*, restaurants(name, address, latitude, longitude)')
          .in('status', ['pending', 'new', 'created', 'waiting', 'open', 'accepted'])
          .is('driver_id', null)
          .order('created_at', { ascending: true });
        if (directErr) {
          console.error('[Delivery] Erro ao buscar pedidos:', directErr.message, '| code:', directErr.code);
        } else {
          ordersData = direct;
          console.log('[Delivery] Direct query pedidos:', direct?.length ?? 0,
            direct?.map((o: any) => `id=${o.id} status=${o.status}`));
        }
      }

      if (ordersData) {
        setPedidos(ordersData.map((o: any, idx: number) => mapOrder(o, idx)));
      }

      // Fetch active order for this driver (driver_id FK = drivers.id, not user_id)
      const activeDriverId = entregador.driver_id || entregador.user_id;
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('*, restaurants(name, address, latitude, longitude)')
        .eq('driver_id', activeDriverId)
        .in('status', ['preparing', 'ready', 'delivering'])
        .maybeSingle();

      if (activeOrder) {
        const appStatus = APP_STATUS_MAP[activeOrder.status] || 'em_andamento';
        const mapped = mapOrder(activeOrder);
        setPedidoAtivo({
          ...mapped,
          status: appStatus as Pedido['status'],
          entregador_id: entregador.user_id,
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
    } finally {
      setIsLoadingOrders(false);
    }
  }, [entregador?.user_id]);

  const fetchHistorico = useCallback(async () => {
    if (!entregador?.user_id) return;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const histDriverId = entregador.driver_id || entregador.user_id;
    const { data } = await supabase
      .from('orders')
      .select(`id, total, delivery_fee, created_at, restaurants (name)`)
      .eq('driver_id', histDriverId)
      .eq('status', 'delivered')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (data) {
      const seen = new Set<string>();
      const hist: HistoricoEntrega[] = data
        .filter((o: any) => {
          if (seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        })
        .map((o: any) => ({
          id: o.id,
          restaurante_nome: o.restaurants?.name || 'Restaurante',
          data: o.created_at.split('T')[0],
          valor: Number(o.delivery_fee) || Number(o.total) * 0.15 || 8.50,
          distancia: '2,5 km',
          status: 'entregue' as const,
        }));
      setHistorico(hist);

      const today = new Date().toISOString().split('T')[0];
      const historicoHoje = hist.filter(h => h.data === today);
      setGanhosDia(historicoHoje.reduce((s, h) => s + h.valor, 0));
      setGanhosSemana(hist.reduce((s, h) => s + h.valor, 0));
      setEntregasHoje(historicoHoje.length);
    }
  }, [entregador?.user_id]);

  // Load on mount / driver change
  useEffect(() => {
    if (entregador?.user_id) {
      fetchOrders();
      fetchHistorico();
    }
  }, [entregador?.user_id]);

  // Play sound + notification when a new order becomes the current one
  useEffect(() => {
    if (!pedidoAtual) return;
    if (pedidoAtual.id === lastAlertedOrderId.current) return;
    lastAlertedOrderId.current = pedidoAtual.id;

    playNewOrderAlert();
    showLocalNotification(
      'Novo pedido disponivel!',
      `${pedidoAtual.restaurante_nome} — R$ ${pedidoAtual.valor_entrega.toFixed(2).replace('.', ',')} — ${pedidoAtual.distancia}`
    );
  }, [pedidoAtual?.id]);

  // When queue is empty, poll every EMPTY_POLL_MS to catch new orders
  useEffect(() => {
    if (emptyPollTimer.current) {
      clearTimeout(emptyPollTimer.current);
      emptyPollTimer.current = null;
    }
    if (pedidos.length === 0 && entregador?.user_id) {
      emptyPollTimer.current = setTimeout(() => fetchOrders(), EMPTY_POLL_MS);
    }
    return () => {
      if (emptyPollTimer.current) clearTimeout(emptyPollTimer.current);
    };
  }, [pedidos.length, entregador?.user_id]);

  // Real-time subscription — refreshes the queue when any order changes
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

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders, fetchHistorico]);

  const aceitarPedido = async (pedidoId: string): Promise<boolean> => {
    if (!entregador?.user_id) return false;
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return false;

    // orders.driver_id is FK → drivers.id (not auth uid)
    const driverFkId = entregador.driver_id || entregador.user_id;

    // 1. Try direct UPDATE (works if RLS allows it)
    const { data: directData, error: directErr } = await supabase
      .from('orders')
      .update({ driver_id: driverFkId, status: 'preparing' })
      .eq('id', pedidoId)
      .is('driver_id', null)
      .select('id');

    const directOk = !directErr && Array.isArray(directData) && directData.length > 0;

    if (!directOk) {
      console.warn('[Delivery] UPDATE aceitar falhou, tentando RPC accept_order:', directErr?.message);

      // 2. Fallback: SECURITY DEFINER RPC bypasses RLS
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('accept_order', {
        p_order_id: pedidoId,
        p_driver_id: driverFkId,
      });

      if (rpcErr || rpcResult?.success !== true) {
        console.error('[Delivery] Falha ao aceitar pedido:', rpcErr?.message || rpcResult?.error);
        fetchOrders();
        return false;
      }
    }

    setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    setPedidoAtivo({ ...pedido, status: 'em_andamento', entregador_id: driverFkId });
    setDeliveryStatus('indo_buscar');
    return true;
  };

  const recusarPedido = (pedidoId: string) => {
    // Remove from the front of the local queue
    setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    // After RECYCLE_DELAY_MS, re-fetch so the refused order cycles back
    // (if no other driver accepted it in the meantime)
    setTimeout(() => fetchOrders(), RECYCLE_DELAY_MS);
  };

  const avancarStatus = async () => {
    if (!pedidoAtivo || !entregador?.user_id) return;

    const nextStatus = {
      indo_buscar: { delivery: 'coletado' as DeliveryStatus, db: 'ready' },
      coletado: { delivery: 'a_caminho' as DeliveryStatus, db: 'delivering' },
    } as Record<string, { delivery: DeliveryStatus; db: string }>;

    const next = nextStatus[deliveryStatus];
    if (!next) return;

    // Optimistic UI update
    setDeliveryStatus(next.delivery);

    const driverFkId = entregador.driver_id || entregador.user_id;

    // 1. Try direct UPDATE
    const { data: directData, error: directErr } = await supabase
      .from('orders')
      .update({ status: next.db })
      .eq('id', pedidoAtivo.id)
      .eq('driver_id', driverFkId)
      .select('id');

    const directOk = !directErr && Array.isArray(directData) && directData.length > 0;

    if (!directOk) {
      console.warn('[Delivery] UPDATE avançar falhou, tentando RPC advance_order_status:', directErr?.message);
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('advance_order_status', {
        p_order_id: pedidoAtivo.id,
        p_new_status: next.db,
      });
      if (rpcErr || rpcResult?.success !== true) {
        console.error('[Delivery] Falha ao avançar status:', rpcErr?.message || rpcResult?.error);
        setDeliveryStatus(deliveryStatus); // revert UI
      }
    }
  };

  const finalizarEntrega = async (): Promise<boolean> => {
    if (!pedidoAtivo || !entregador?.user_id) return false;

    const orderId = pedidoAtivo.id;
    // orders.driver_id FK → drivers.id (not auth uid)
    const driverId = entregador.driver_id || entregador.user_id;
    const earnings = pedidoAtivo.valor_entrega;

    // 1. Try direct UPDATE (works when RLS allows driver to set 'delivered')
    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        driver_earnings: earnings,
      })
      .eq('id', orderId)
      .eq('driver_id', driverId)
      .in('status', ['delivering', 'ready', 'preparing'])
      .select('id');

    const directOk = !updateErr && Array.isArray(updated) && updated.length > 0;

    if (!directOk) {
      console.warn('[Delivery] UPDATE direto falhou, tentando RPC finalize_delivery:', updateErr?.message);

      // 2. Fallback: SECURITY DEFINER RPC (bypasses RLS, no driver_id filter)
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('finalize_delivery', {
        p_order_id: orderId,
        p_earnings: earnings,
      });

      const rpcOk = !rpcErr && rpcResult?.success === true;
      if (!rpcOk) {
        console.error('[Delivery] Falha definitiva ao finalizar entrega:', rpcErr?.message || rpcResult?.error);
        return false;
      }
    }

    // 3. Record status history (best-effort, ignore table-not-found)
    supabase
      .from('order_status_history')
      .insert({ order_id: orderId, status: 'delivered', driver_id: driverId, changed_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error && !error.message?.includes('does not exist')) {
          console.warn('[Delivery] order_status_history insert falhou:', error.message);
        }
      });

    // 4. Update local state only after DB success
    setGanhosDia(prev => prev + earnings);
    setGanhosSemana(prev => prev + earnings);
    setEntregasHoje(prev => prev + 1);
    setPedidoAtivo(null);
    setDeliveryStatus('indo_buscar');
    fetchOrders();
    fetchHistorico();
    return true;
  };

  const refreshOrders = async () => { await fetchOrders(); };

  return (
    <DeliveryContext.Provider value={{
      pedidoAtual,
      totalDisponiveis,
      pedidoAtivo,
      deliveryStatus,
      historico,
      ganhosDia,
      ganhosSemana,
      entregasHoje,
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
