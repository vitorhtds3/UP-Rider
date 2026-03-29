import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { registerForPushNotifications, removePushToken } from '@/services/notifications';

export interface Entregador {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string;
  veiculo: string;
  foto: string;
  status: 'online' | 'offline';
  ganhos_dia: number;
  entregas_hoje: number;
  driver_id?: string;
  role?: string;
  accountStatus?: string;
}

interface AuthContextType {
  entregador: Entregador | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateEntregador: (data: Partial<Entregador>) => void;
  refreshUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchEntregadorData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchEntregadorData(session.user.id);
      } else {
        setEntregador(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEntregadorData = async (userId: string) => {
    try {
      // All user info comes from auth metadata (no users table needed)
      const { data: authResp } = await supabase.auth.getUser();
      const meta = authResp?.user?.user_metadata || {};

      // Fetch driver profile via SECURITY DEFINER RPC to bypass RLS
      const { data: driverRpc } = await supabase
        .rpc('get_driver_status', { p_user_id: userId })
        .maybeSingle();

      // Also try direct SELECT (works if SELECT policy is in place)
      const { data: driverDirect } = await supabase
        .from('drivers')
        .select('id, user_id, status, is_online, latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle();

      const driverStatus  = driverRpc?.drv_status  || driverDirect?.status  || 'pending';
      const driverOnline  = driverRpc?.drv_is_online ?? driverDirect?.is_online ?? false;
      const driverDbId    = driverRpc?.drv_id       || driverDirect?.id;

      console.log('[Auth] meta:', `name=${meta.name}, status=${meta.status}`);
      console.log('[Auth] driverData:', `status=${driverStatus}, is_online=${driverOnline}`);

      // accountStatus: drivers.status is the source of truth for approval
      const accountStatus = driverStatus || meta.status || 'pending';
      console.log('[Auth] accountStatus resolved to:', accountStatus);

      // Compute today's earnings
      const today = new Date().toISOString().split('T')[0];
      const { data: ordersToday } = await supabase
        .from('orders')
        .select('delivery_fee, total')
        .eq('driver_id', userId)
        .eq('status', 'delivered')
        .gte('created_at', today);

      const ganhosDia = (ordersToday || []).reduce(
        (sum: number, o: any) => sum + (Number(o.delivery_fee) || Number(o.total) * 0.15 || 0),
        0
      );

      const { count: entregasHoje } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userId)
        .eq('status', 'delivered')
        .gte('created_at', today);

      setEntregador({
        id: userId,
        user_id: userId,
        nome: meta.name || '',
        email: authResp?.user?.email || '',
        telefone: meta.phone || '',
        veiculo: meta.vehicle || 'Moto',
        foto: '',
        status: driverOnline ? 'online' : 'offline',
        ganhos_dia: ganhosDia,
        entregas_hoje: entregasHoje || 0,
        driver_id: driverDbId,
        role: meta.role || 'driver',
        accountStatus,
      });
    } catch (e) {
      console.error('[Auth] Erro ao buscar dados:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setIsLoading(false);
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Email ou senha incorretos.' };
      }
      return { success: false, error: error.message };
    }

    if (!data.session) {
      setIsLoading(false);
      return { success: false, error: 'Erro ao iniciar sessao.' };
    }

    // Role check from auth metadata only (no users table)
    const role = data.user?.user_metadata?.role;
    if (role && role !== 'driver') {
      await supabase.auth.signOut();
      setIsLoading(false);
      return { success: false, error: 'Acesso restrito a entregadores.' };
    }

    registerForPushNotifications(data.session.user.id).catch(console.error);
    return { success: true };
  };

  const refreshUserData = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id) {
      await fetchEntregadorData(currentSession.user.id);
    }
  };

  const logout = async () => {
    if (entregador?.user_id) {
      await removePushToken(entregador.user_id);
    }
    await supabase.auth.signOut();
    setEntregador(null);
    setSession(null);
  };

  const updateEntregador = async (data: Partial<Entregador>) => {
    if (!entregador) return;

    setEntregador({ ...entregador, ...data });

    // Sync online/offline to drivers table
    if (data.status !== undefined) {
      const isOnlineNow = data.status === 'online';

      const { error: rpcErr } = await supabase.rpc('set_driver_online', {
        p_user_id: entregador.user_id,
        p_is_online: isOnlineNow,
      });

      if (rpcErr) {
        const { error: updateErr } = await supabase
          .from('drivers')
          .update({ is_online: isOnlineNow, last_update: new Date().toISOString() })
          .eq('user_id', entregador.user_id);
        if (updateErr) {
          console.warn('[Auth] is_online sync failed:', updateErr.message);
        }
      }

      if (Platform.OS !== 'web') {
        if (isOnlineNow) {
          startLocationTracking(entregador.user_id);
        } else {
          stopLocationTracking();
        }
      }
    }

    // Sync name/phone to auth metadata (no users table)
    if (data.nome || data.telefone) {
      const metaUpdate: any = {};
      if (data.nome) metaUpdate.name = data.nome;
      if (data.telefone) metaUpdate.phone = data.telefone;
      await supabase.auth.updateUser({ data: metaUpdate });
    }
  };

  const locationSubscriptionRef = React.useRef<Location.LocationSubscription | null>(null);

  const startLocationTracking = async (userId: string) => {
    if (Platform.OS === 'web') return;
    stopLocationTracking();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 50, timeInterval: 30000 },
      async (location) => {
        await supabase
          .from('drivers')
          .update({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            last_update: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
    );
  };

  const stopLocationTracking = () => {
    if (Platform.OS === 'web') return;
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopLocationTracking();
  }, []);

  const isAuthenticated = !!session && !!entregador;

  return (
    <AuthContext.Provider value={{ entregador, session, isAuthenticated, isLoading, login, logout, updateEntregador, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}
