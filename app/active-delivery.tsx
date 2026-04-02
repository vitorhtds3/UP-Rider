import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from '@/components/MapWrapper';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDelivery } from '@/hooks/useDelivery';
import { supabase } from '@/services/supabase';

const { width: SW, height: SH } = Dimensions.get('window');

// Deliveroo Ride palette
const DR = {
  bg: '#0F1923',
  surface: '#1A2533',
  card: '#1E2D3D',
  accent: '#00C896',
  orange: '#FF6B2B',
  red: '#EF4444',
  blue: '#3B82F6',
  white: '#FFFFFF',
  white80: 'rgba(255,255,255,0.80)',
  white60: 'rgba(255,255,255,0.60)',
  white30: 'rgba(255,255,255,0.30)',
  white10: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
};

const DEFAULT = { latitude: -23.5505, longitude: -46.6333 };
const LOCATION_INTERVAL = 8000;

type DeliveryStep = { key: string; label: string; sublabel: string; icon: keyof typeof MaterialIcons.glyphMap };

const STEPS: DeliveryStep[] = [
  { key: 'indo_buscar', label: 'Indo ao restaurante', sublabel: 'A caminho do ponto de coleta', icon: 'store' },
  { key: 'coletado', label: 'Pedido coletado', sublabel: 'Retirado — indo ao cliente', icon: 'inventory' },
  { key: 'a_caminho', label: 'A caminho', sublabel: 'Entregando ao cliente', icon: 'delivery-dining' },
  { key: 'entregue', label: 'Entregue!', sublabel: 'Pedido concluido com sucesso', icon: 'check-circle' },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

function StepIndicator({ steps, currentIdx }: { steps: DeliveryStep[]; currentIdx: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <View style={[stepStyles.dot, done && stepStyles.dotDone, current && stepStyles.dotCurrent]}>
              {done ? (
                <MaterialIcons name="check" size={12} color="#fff" />
              ) : (
                <Text style={[stepStyles.dotNum, current && { color: '#fff' }]}>{i + 1}</Text>
              )}
            </View>
            {i < steps.length - 1 && (
              <View style={[stepStyles.line, done && stepStyles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: DR.white10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: DR.border },
  dotDone: { backgroundColor: DR.accent, borderColor: DR.accent },
  dotCurrent: { backgroundColor: DR.orange, borderColor: DR.orange },
  dotNum: { fontSize: 10, fontWeight: '700', color: DR.white60 },
  line: { flex: 1, height: 2, backgroundColor: DR.white10 },
  lineDone: { backgroundColor: DR.accent },
});

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pedidoAtivo, deliveryStatus, avancarStatus, finalizarEntrega } = useDelivery();
  const mapRef = useRef<any>(null);

  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distToTarget, setDistToTarget] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickup = pedidoAtivo?.latitude_coleta && pedidoAtivo?.longitude_coleta
    ? { latitude: pedidoAtivo.latitude_coleta, longitude: pedidoAtivo.longitude_coleta }
    : DEFAULT;

  const dropoff = pedidoAtivo?.latitude_entrega && pedidoAtivo?.longitude_entrega
    ? { latitude: pedidoAtivo.latitude_entrega, longitude: pedidoAtivo.longitude_entrega }
    : { latitude: pickup.latitude - 0.012, longitude: pickup.longitude + 0.015 };

  const goingToPickup = deliveryStatus === 'indo_buscar' || deliveryStatus === 'coletado';
  const target = goingToPickup ? pickup : dropoff;
  const targetAddress = goingToPickup
    ? (pedidoAtivo?.endereco_coleta ?? '')
    : (pedidoAtivo?.endereco_entrega ?? '');

  const currentIdx = STEPS.findIndex(s => s.key === deliveryStatus);
  const currentStep = STEPS[Math.max(0, currentIdx)];

  // Update driver location
  const updateLocation = useCallback(async () => {
    try {
      let coords: { latitude: number; longitude: number } | null = null;

      if (Platform.OS !== 'web') {
        const { Location } = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      } else if (navigator.geolocation) {
        await new Promise<void>(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => {
              coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              resolve();
            },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      }

      if (coords) {
        setDriverCoords(coords);
        const dist = haversine(coords.latitude, coords.longitude, target.latitude, target.longitude);
        setDistToTarget(fmtDist(dist));

        // Sync to DB if driver_id available
        if (pedidoAtivo?.entregador_id) {
          supabase
            .from('drivers')
            .update({ latitude: coords.latitude, longitude: coords.longitude, last_update: new Date().toISOString() })
            .eq('user_id', pedidoAtivo.entregador_id)
            .then(() => {});
        }
      }
    } catch (_) {}
  }, [target.latitude, target.longitude, pedidoAtivo?.entregador_id]);

  useEffect(() => {
    updateLocation();
    intervalRef.current = setInterval(updateLocation, LOCATION_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [updateLocation]);

  useEffect(() => {
    setDistToTarget(null);
    updateLocation();
  }, [deliveryStatus]);

  // Fit map
  useEffect(() => {
    if (mapRef.current && pedidoAtivo) {
      setTimeout(() => {
        const coords = [pickup, dropoff];
        if (driverCoords) coords.push(driverCoords);
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 60, bottom: 320, left: 60 },
          animated: true,
        });
      }, 800);
    }
  }, [pedidoAtivo, driverCoords]);

  // Panel slide-up animation
  useEffect(() => {
    Animated.spring(panelAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  }, []);

  const panelTranslate = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  const openNavigation = () => {
    const { latitude, longitude } = target;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(googleUrl).catch(() => {});
  };

  const handleAction = () => {
    if (deliveryStatus === 'a_caminho') {
      setConfirmVisible(true);
    } else {
      avancarStatus();
    }
  };

  const handleFinalize = async () => {
    setConfirmVisible(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    await finalizarEntrega();
    router.replace('/(tabs)');
  };

  if (!pedidoAtivo) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialIcons name="delivery-dining" size={56} color={DR.white30} />
        <Text style={{ color: DR.white60, fontSize: 16, marginTop: 16 }}>Nenhuma entrega ativa</Text>
        <TouchableOpacity
          style={{ marginTop: 20, backgroundColor: DR.white10, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: DR.accent, fontWeight: '700' }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const midLat = (pickup.latitude + dropoff.latitude) / 2;
  const midLng = (pickup.longitude + dropoff.longitude) / 2;
  const latDelta = Math.max(Math.abs(pickup.latitude - dropoff.latitude) * 3, 0.02);
  const lngDelta = Math.max(Math.abs(pickup.longitude - dropoff.longitude) * 3, 0.02);

  const polyline = driverCoords ? [driverCoords, target] : [pickup, dropoff];

  return (
    <View style={styles.container}>
      {/* FULL MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Pickup */}
        <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1 }}>
          <View style={markerStyles.pickup}>
            <MaterialIcons name="store" size={16} color="#fff" />
          </View>
        </Marker>

        {/* Dropoff */}
        <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 1 }}>
          <View style={markerStyles.dropoff}>
            <MaterialIcons name="home" size={16} color="#fff" />
          </View>
        </Marker>

        {/* Driver */}
        {driverCoords && (
          <Marker coordinate={driverCoords}>
            <View style={markerStyles.driver}>
              <MaterialIcons name="two-wheeler" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Active route */}
        <Polyline
          coordinates={polyline}
          strokeColor={goingToPickup ? DR.orange : DR.accent}
          strokeWidth={4}
        />

        {/* Full route dashed */}
        <Polyline
          coordinates={[pickup, dropoff]}
          strokeColor="rgba(255,255,255,0.3)"
          strokeWidth={2}
          lineDashPattern={[6, 6]}
        />
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color={DR.white} />
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>{currentStep.label}</Text>
          <Text style={styles.topSub}>{currentStep.sublabel}</Text>
        </View>

        <View style={styles.earningPill}>
          <Text style={styles.earningVal}>R$ {pedidoAtivo.valor_entrega.toFixed(2).replace('.', ',')}</Text>
        </View>
      </View>

      {/* Navigate FAB */}
      <TouchableOpacity style={styles.navFab} onPress={openNavigation} activeOpacity={0.9}>
        <MaterialIcons name="navigation" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Distance chip */}
      {distToTarget && (
        <View style={styles.distChip}>
          <MaterialIcons name="straighten" size={13} color={DR.white60} />
          <Text style={styles.distChipText}>{distToTarget}</Text>
        </View>
      )}

      {/* Bottom panel */}
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 12, transform: [{ translateY: panelTranslate }] }]}>
        {/* Step indicators */}
        <View style={styles.panelSteps}>
          <StepIndicator steps={STEPS} currentIdx={currentIdx} />
        </View>

        {/* Route summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: DR.orange }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeType}>Coleta — {pedidoAtivo.restaurante_nome}</Text>
              <Text style={styles.routeAddr} numberOfLines={1}>{pedidoAtivo.endereco_coleta}</Text>
            </View>
            {goingToPickup && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Ativo</Text></View>}
          </View>

          <View style={styles.routeConnector}>
            <View style={styles.connectorLine} />
          </View>

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: DR.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeType}>Entrega — {pedidoAtivo.cliente_nome}</Text>
              <Text style={styles.routeAddr} numberOfLines={1}>{pedidoAtivo.endereco_entrega}</Text>
            </View>
            {!goingToPickup && deliveryStatus !== 'entregue' && (
              <View style={[styles.activeBadge, { backgroundColor: 'rgba(0,200,150,0.2)', borderColor: DR.accent }]}>
                <Text style={[styles.activeBadgeText, { color: DR.accent }]}>Ativo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialIcons name="straighten" size={16} color={DR.white60} />
            <Text style={styles.statValue}>{distToTarget ?? pedidoAtivo.distancia}</Text>
            <Text style={styles.statLabel}>Distancia</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialIcons name="access-time" size={16} color={DR.white60} />
            <Text style={styles.statValue}>{pedidoAtivo.tempo_estimado}</Text>
            <Text style={styles.statLabel}>Estimado</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialIcons name="account-balance-wallet" size={16} color={DR.accent} />
            <Text style={[styles.statValue, { color: DR.accent }]}>R$ {pedidoAtivo.valor_entrega.toFixed(2).replace('.', ',')}</Text>
            <Text style={styles.statLabel}>Ganho</Text>
          </View>
        </View>

        {/* Action button */}
        {deliveryStatus !== 'entregue' && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleAction} activeOpacity={0.88}>
            <MaterialIcons
              name={
                deliveryStatus === 'indo_buscar' ? 'inventory' :
                deliveryStatus === 'coletado' ? 'delivery-dining' : 'check-circle'
              }
              size={22}
              color="#fff"
            />
            <Text style={styles.actionBtnText}>
              {deliveryStatus === 'indo_buscar' && 'Cheguei — Pedido coletado'}
              {deliveryStatus === 'coletado' && 'Iniciar entrega ao cliente'}
              {deliveryStatus === 'a_caminho' && 'Confirmar entrega'}
            </Text>
          </TouchableOpacity>
        )}

        {deliveryStatus === 'entregue' && (
          <View style={styles.completedBox}>
            <MaterialIcons name="check-circle" size={28} color={DR.accent} />
            <Text style={styles.completedText}>Entrega concluida!</Text>
          </View>
        )}
      </Animated.View>

      {/* Confirm finish modal */}
      {confirmVisible && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <MaterialIcons name="check-circle-outline" size={36} color={DR.accent} />
            </View>
            <Text style={styles.confirmTitle}>Confirmar entrega?</Text>
            <Text style={styles.confirmText}>O pedido foi entregue ao cliente com sucesso?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.confirmCancelText}>Nao</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOk} onPress={handleFinalize}>
                <Text style={styles.confirmOkText}>Sim, entregue!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const markerStyles = StyleSheet.create({
  pickup: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF6B2B',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 6,
  },
  dropoff: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#00C896',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 6,
  },
  driver: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 6,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DR.bg },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(15,25,35,0.85)',
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: DR.white10,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  topCenter: { flex: 1, marginTop: 2 },
  topTitle: { fontSize: 16, fontWeight: '700', color: DR.white },
  topSub: { fontSize: 12, color: DR.white60, marginTop: 2 },
  earningPill: {
    backgroundColor: 'rgba(0,200,150,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  earningVal: { fontSize: 14, fontWeight: '800', color: DR.accent },

  navFab: {
    position: 'absolute',
    right: 16,
    bottom: 360,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DR.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DR.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },

  distChip: {
    position: 'absolute',
    left: 16,
    bottom: 360,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,25,35,0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: DR.border,
  },
  distChipText: { fontSize: 13, fontWeight: '600', color: DR.white80 },

  panel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: DR.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: DR.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },

  panelSteps: { marginBottom: 16 },

  routeCard: {
    backgroundColor: DR.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DR.border,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeConnector: { paddingLeft: 4, paddingVertical: 4 },
  connectorLine: { width: 2, height: 10, backgroundColor: DR.white10 },
  routeType: { fontSize: 13, fontWeight: '600', color: DR.white },
  routeAddr: { fontSize: 11, color: DR.white60, marginTop: 2 },
  activeBadge: {
    backgroundColor: 'rgba(255,107,43,0.2)',
    borderWidth: 1,
    borderColor: '#FF6B2B',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#FF6B2B' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: DR.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: DR.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, backgroundColor: DR.border },
  statValue: { fontSize: 15, fontWeight: '700', color: DR.white },
  statLabel: { fontSize: 10, color: DR.white60 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DR.accent,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: DR.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  completedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,200,150,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.3)',
  },
  completedText: { fontSize: 16, fontWeight: '700', color: DR.accent },

  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: DR.card,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DR.border,
  },
  confirmIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,200,150,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: DR.white, marginBottom: 8, textAlign: 'center' },
  confirmText: { fontSize: 14, color: DR.white60, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: {
    flex: 1, borderWidth: 1.5, borderColor: DR.border,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '700', color: DR.white60 },
  confirmOk: {
    flex: 2, backgroundColor: DR.accent,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: DR.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5,
  },
  confirmOkText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
