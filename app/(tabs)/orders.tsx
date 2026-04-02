import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from '@/components/MapWrapper';
import { useDelivery } from '@/hooks/useDelivery';
import { useAuth } from '@/hooks/useAuth';
import { Pedido } from '@/contexts/DeliveryContext';

const { width: SW, height: SH } = Dimensions.get('window');

// Deliveroo Ride color palette
const DRColors = {
  bg: '#0F1923',
  surface: '#1A2533',
  card: '#1E2D3D',
  accent: '#00C896',
  accentDark: '#009E77',
  orange: '#FF6B2B',
  red: '#EF4444',
  white: '#FFFFFF',
  white80: 'rgba(255,255,255,0.80)',
  white50: 'rgba(255,255,255,0.50)',
  white20: 'rgba(255,255,255,0.20)',
  white10: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  mapOverlay: 'rgba(15,25,35,0.92)',
  pickup: '#FF6B2B',
  dropoff: '#00C896',
};

const TIMER_DURATION = 30;

function useOrderTimer(orderId: string, active: boolean, onExpire: (id: string) => void) {
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    setTimeLeft(TIMER_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onExpire(orderId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [orderId, active]);

  return timeLeft;
}

function OrderMapPreview({ pedido, driverCoords }: { pedido: Pedido; driverCoords: { latitude: number; longitude: number } | null }) {
  const pickup = pedido.latitude_coleta && pedido.longitude_coleta
    ? { latitude: pedido.latitude_coleta, longitude: pedido.longitude_coleta }
    : { latitude: -23.5505, longitude: -46.6333 };

  const dropoff = pedido.latitude_entrega && pedido.longitude_entrega
    ? { latitude: pedido.latitude_entrega, longitude: pedido.longitude_entrega }
    : { latitude: pickup.latitude - 0.012, longitude: pickup.longitude + 0.015 };

  const midLat = (pickup.latitude + dropoff.latitude) / 2;
  const midLng = (pickup.longitude + dropoff.longitude) / 2;
  const latDelta = Math.max(Math.abs(pickup.latitude - dropoff.latitude) * 2.5, 0.02);
  const lngDelta = Math.max(Math.abs(pickup.longitude - dropoff.longitude) * 2.5, 0.02);

  const allCoords = driverCoords
    ? [driverCoords, pickup, dropoff]
    : [pickup, dropoff];

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {/* Pickup marker */}
      <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1 }}>
        <View style={mapStyles.pickupMarker}>
          <MaterialIcons name="store" size={14} color="#fff" />
        </View>
      </Marker>

      {/* Dropoff marker */}
      <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 1 }}>
        <View style={mapStyles.dropoffMarker}>
          <MaterialIcons name="home" size={14} color="#fff" />
        </View>
      </Marker>

      {/* Driver marker */}
      {driverCoords && (
        <Marker coordinate={driverCoords}>
          <View style={mapStyles.driverMarker}>
            <MaterialIcons name="two-wheeler" size={12} color="#fff" />
          </View>
        </Marker>
      )}

      {/* Route line */}
      <Polyline
        coordinates={allCoords}
        strokeColor={DRColors.accent}
        strokeWidth={3}
      />
      <Polyline
        coordinates={[pickup, dropoff]}
        strokeColor="rgba(255,255,255,0.25)"
        strokeWidth={2}
        lineDashPattern={[6, 6]}
      />
    </MapView>
  );
}

const mapStyles = StyleSheet.create({
  pickupMarker: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: DRColors.pickup,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
  },
  dropoffMarker: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: DRColors.dropoff,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
  },
  driverMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
});

function OrderCard({
  pedido,
  driverCoords,
  onAccept,
  onDecline,
}: {
  pedido: Pedido;
  driverCoords: { latitude: number; longitude: number } | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const timeLeft = useOrderTimer(pedido.id, true, onDecline);
  const progress = timeLeft / TIMER_DURATION;
  const isUrgent = timeLeft <= 10;

  return (
    <View style={cardStyles.container}>
      {/* Map section */}
      <View style={cardStyles.mapSection}>
        <OrderMapPreview pedido={pedido} driverCoords={driverCoords} />

        {/* Timer overlay top-right */}
        <View style={[cardStyles.timerBubble, isUrgent && cardStyles.timerBubbleUrgent]}>
          <Text style={[cardStyles.timerText, isUrgent && cardStyles.timerTextUrgent]}>{timeLeft}s</Text>
        </View>

        {/* Timer progress bar */}
        <View style={cardStyles.timerBar}>
          <View style={[cardStyles.timerBarFill, {
            width: `${progress * 100}%`,
            backgroundColor: isUrgent ? DRColors.red : DRColors.accent,
          }]} />
        </View>
      </View>

      {/* Details section */}
      <View style={cardStyles.details}>
        {/* Earning + distance row */}
        <View style={cardStyles.topRow}>
          <View style={cardStyles.earningBox}>
            <Text style={cardStyles.earningValue}>R$ {pedido.valor_entrega.toFixed(2).replace('.', ',')}</Text>
            <Text style={cardStyles.earningLabel}>Ganho</Text>
          </View>
          <View style={cardStyles.metaRow}>
            <View style={cardStyles.metaItem}>
              <MaterialIcons name="straighten" size={14} color={DRColors.white50} />
              <Text style={cardStyles.metaText}>{pedido.distancia}</Text>
            </View>
            <View style={cardStyles.metaItem}>
              <MaterialIcons name="access-time" size={14} color={DRColors.white50} />
              <Text style={cardStyles.metaText}>{pedido.tempo_estimado}</Text>
            </View>
          </View>
        </View>

        {/* Route */}
        <View style={cardStyles.routeBox}>
          {/* Pickup */}
          <View style={cardStyles.routeRow}>
            <View style={cardStyles.routeDotPickup} />
            <View style={{ flex: 1 }}>
              <Text style={cardStyles.routeLabel}>Coleta</Text>
              <Text style={cardStyles.routeValue} numberOfLines={1}>{pedido.restaurante_nome}</Text>
              <Text style={cardStyles.routeAddress} numberOfLines={1}>{pedido.endereco_coleta}</Text>
            </View>
          </View>

          <View style={cardStyles.routeLine} />

          {/* Dropoff */}
          <View style={cardStyles.routeRow}>
            <View style={cardStyles.routeDotDropoff} />
            <View style={{ flex: 1 }}>
              <Text style={cardStyles.routeLabel}>Entrega</Text>
              <Text style={cardStyles.routeValue} numberOfLines={1}>{pedido.cliente_nome}</Text>
              <Text style={cardStyles.routeAddress} numberOfLines={1}>{pedido.endereco_entrega}</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={cardStyles.actions}>
          <TouchableOpacity style={cardStyles.declineBtn} onPress={onDecline} activeOpacity={0.8}>
            <MaterialIcons name="close" size={20} color={DRColors.red} />
            <Text style={cardStyles.declineBtnText}>Recusar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={cardStyles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text style={cardStyles.acceptBtnText}>Aceitar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: DRColors.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DRColors.border,
  },
  mapSection: {
    height: 200,
    position: 'relative',
  },
  timerBubble: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: DRColors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: DRColors.accent,
  },
  timerBubbleUrgent: {
    borderColor: DRColors.red,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: DRColors.accent,
  },
  timerTextUrgent: {
    color: DRColors.red,
  },
  timerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: DRColors.white10,
  },
  timerBarFill: {
    height: 3,
  },
  details: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  earningBox: {},
  earningValue: {
    fontSize: 26,
    fontWeight: '800',
    color: DRColors.accent,
    letterSpacing: -0.5,
  },
  earningLabel: {
    fontSize: 11,
    color: DRColors.white50,
    marginTop: 1,
  },
  metaRow: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: DRColors.white80,
    fontWeight: '500',
  },
  routeBox: {
    backgroundColor: DRColors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeDotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DRColors.pickup,
    marginTop: 4,
    flexShrink: 0,
  },
  routeDotDropoff: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DRColors.dropoff,
    marginTop: 4,
    flexShrink: 0,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: DRColors.border,
    marginLeft: 4,
    marginVertical: 4,
  },
  routeLabel: {
    fontSize: 10,
    color: DRColors.white50,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: DRColors.white,
  },
  routeAddress: {
    fontSize: 12,
    color: DRColors.white50,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: DRColors.red,
    borderRadius: 12,
    paddingVertical: 14,
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: DRColors.red,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DRColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: DRColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pedidosDisponiveis, pedidoAtivo, aceitarPedido, recusarPedido, isLoadingOrders, refreshOrders } = useDelivery();
  const { entregador } = useAuth();
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isOnline = entregador?.status === 'online';

  // Get driver location for map
  useEffect(() => {
    let mounted = true;
    const getLocation = async () => {
      try {
        if (Platform.OS !== 'web') {
          const { Location } = await import('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (mounted) setDriverCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => { if (mounted) setDriverCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
            () => {}
          );
        }
      } catch (_) {}
    };
    getLocation();
    return () => { mounted = false; };
  }, []);

  const handleAccept = async (pedidoId: string) => {
    if (pedidoAtivo) return;
    await aceitarPedido(pedidoId);
    router.push('/active-delivery');
  };

  const handleDecline = (pedidoId: string) => {
    recusarPedido(pedidoId);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Pedidos</Text>
          <View style={[styles.statusPill, { backgroundColor: isOnline ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.08)' }]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? DRColors.accent : DRColors.white50 }]} />
            <Text style={[styles.statusText, { color: isOnline ? DRColors.accent : DRColors.white50 }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.countBadge, { backgroundColor: pedidosDisponiveis.length > 0 ? 'rgba(0,200,150,0.2)' : DRColors.white10 }]}>
            <Text style={[styles.countText, { color: pedidosDisponiveis.length > 0 ? DRColors.accent : DRColors.white50 }]}>
              {pedidosDisponiveis.length}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color={DRColors.accent} />
            ) : (
              <MaterialIcons name="refresh" size={22} color={DRColors.white80} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {!isOnline ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <MaterialIcons name="wifi-off" size={36} color={DRColors.white50} />
          </View>
          <Text style={styles.emptyTitle}>Voce esta offline</Text>
          <Text style={styles.emptyText}>Va para o inicio e ative o modo online para receber pedidos.</Text>
        </View>
      ) : isLoadingOrders && pedidosDisponiveis.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={DRColors.accent} />
          <Text style={styles.emptyText} style={{ marginTop: 16 }}>Buscando pedidos...</Text>
        </View>
      ) : pedidosDisponiveis.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <MaterialIcons name="receipt-long" size={36} color={DRColors.white50} />
          </View>
          <Text style={styles.emptyTitle}>Nenhum pedido</Text>
          <Text style={styles.emptyText}>Aguardando novos pedidos na sua regiao...</Text>
          <TouchableOpacity style={styles.refreshPill} onPress={handleRefresh}>
            <MaterialIcons name="refresh" size={16} color={DRColors.accent} />
            <Text style={styles.refreshPillText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {pedidoAtivo !== null && (
            <TouchableOpacity
              style={styles.activeDeliveryBanner}
              onPress={() => router.push('/active-delivery')}
              activeOpacity={0.85}
            >
              <View style={styles.activePulse} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeBannerTitle}>Entrega em andamento</Text>
                <Text style={styles.activeBannerSub}>Finalize antes de aceitar um novo</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={DRColors.accent} />
            </TouchableOpacity>
          )}

          {pedidosDisponiveis.map(pedido => (
            <OrderCard
              key={pedido.id}
              pedido={pedido}
              driverCoords={driverCoords}
              onAccept={() => handleAccept(pedido.id)}
              onDecline={() => handleDecline(pedido.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DRColors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: DRColors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: DRColors.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  countBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontWeight: '800',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DRColors.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
  },
  activeDeliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,200,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  activePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DRColors.accent,
  },
  activeBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DRColors.accent,
  },
  activeBannerSub: {
    fontSize: 12,
    color: DRColors.white50,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DRColors.white10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DRColors.white,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: DRColors.white50,
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,200,150,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.3)',
  },
  refreshPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: DRColors.accent,
  },
});
