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

  // Handle app state for session refresh
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

  // Initialize session
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
      // Fetch user data from public.users table
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // Fall back to auth metadata if public.users row is not yet available
      // (can happen briefly after registration or if RLS restricts access)
      let resolvedUser = userData;
      if (!resolvedUser) {
        const { data: authResp } = await supabase.auth.getUser();
        const meta = authResp?.user?.user_metadata;
        if (meta) {
          resolvedUser = {
            name: meta.name || '',
            email: authResp?.user?.email || '',
            phone: meta.phone || '',
            role: meta.role || 'driver',
            status: meta.status || 'pending',
          };
        }
      }

      // If we still have no user info at all, bail out
      if (!resolvedUser) {
        setIsLoading(false);
        return;
      }

      // Only allow drivers to use this app
      if (resolvedUser.role && resolvedUser.role !== 'driver') {
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // Fetch driver profile via SECURITY DEFINER RPC to bypass RLS on SELECT
      const { data: driverRpcRow } = await supabase
        .rpc('get_driver_status', { p_user_id: userId })
        .maybeSingle();

      // Also try direct SELECT as fallback (works if RLS allows it)
      const { data: driverDirect } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Merge: prefer RPC result for status (bypasses RLS), use direct for other fields
      const driverData = driverDirect || driverRpcRow
        ? {
            id: driverRpcRow?.drv_id || driverDirect?.id,
            status: driverRpcRow?.drv_status || driverDirect?.status,
            is_online: driverRpcRow?.drv_is_online ?? driverDirect?.is_online ?? false,
            vehicle_type: driverDirect?.vehicle_type,
          }
        : null;

      // Resolve vehicle — prefer DB row, fall back to auth metadata
      const { data: authResp2 } = await supabase.auth.getUser();
      const vehicleFromMeta = authResp2?.user?.user_metadata?.vehicle;
      const veiculo = driverData?.vehicle_type || vehicleFromMeta || 'Moto';

      // Compute today's earnings from completed orders
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

      // Count today's deliveries
      const { count: entregasHoje } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userId)
        .eq('status', 'delivered')
        .gte('created_at', today);

      // accountStatus comes from drivers.status first (admin manages approval there),
      // falling back to users.status, then auth metadata status
      console.log('[Auth] userData:', userData ? `status=${userData.status}` : 'null/blocked');
      console.log('[Auth] driverData:', driverData ? `status=${driverData.status}, is_online=${driverData.is_online}` : 'null/blocked');
      const accountStatus = driverData?.status || resolvedUser.status || 'pending';
      console.log('[Auth] accountStatus resolved to:', accountStatus);

      setEntregador({
        id: userId,
        user_id: userId,
        nome: resolvedUser.name || '',
        email: resolvedUser.email || '',
        telefone: resolvedUser.phone || '',
        veiculo,
        foto: '',
        status: driverData?.is_online ? 'online' : 'offline',
        ganhos_dia: ganhosDia,
        entregas_hoje: entregasHoje || 0,
        driver_id: driverData?.id,
        role: resolvedUser.role,
        accountStatus,
      });
    } catch (e) {
      console.error('Erro ao buscar dados do entregador:', e);
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

    // Verify this user is a driver
    // Check DB first, fall back to auth metadata
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.session.user.id)
      .maybeSingle();

    const role = userData?.role || data.user?.user_metadata?.role;
    if (role && role !== 'driver') {
      await supabase.auth.signOut();
      setIsLoading(false);
      return { success: false, error: 'Acesso restrito a entregadores.' };
    }

    // Register push token after successful login
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
    // Remove push token on logout
    if (entregador?.user_id) {
      await removePushToken(entregador.user_id);
    }
    await supabase.auth.signOut();
    setEntregador(null);
    setSession(null);
  };

  const updateEntregador = async (data: Partial<Entregador>) => {
    if (!entregador) return;

    // Update local state immediately
    setEntregador({ ...entregador, ...data });

    // Sync online/offline status to drivers table (by user_id — always available)
    if (data.status !== undefined) {
      const isOnlineNow = data.status === 'online';
      const { error: onlineErr } = await supabase
        .from('drivers')
        .update({ is_online: isOnlineNow, last_update: new Date().toISOString() })
        .eq('user_id', entregador.user_id);

      if (onlineErr) {
        console.warn('[Auth] failed to update is_online:', onlineErr.message);
      }

      // Location tracking — only on native (not web)
      if (Platform.OS !== 'web') {
        if (isOnlineNow) {
          startLocationTracking(entregador.user_id);
        } else {
          stopLocationTracking();
        }
      }
    }

    // Sync profile fields to users table
    const userUpdates: any = {};
    if (data.nome) userUpdates.name = data.nome;
    if (data.telefone) userUpdates.phone = data.telefone;

    if (Object.keys(userUpdates).length > 0) {
      await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', entregador.user_id);
    }
  };

  // Location tracking
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

  // Stop tracking on unmount
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
