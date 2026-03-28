import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Platform,
  ActionSheetIOS,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from '@/components/MapWrapper';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDelivery } from '@/hooks/useDelivery';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 280;
const LOCATION_UPDATE_INTERVAL = 10000;

type DeliveryStep = {
  key: string;
  label: string;
  sublabel: string;
  icon: string;
};

const STEPS: DeliveryStep[] = [
  { key: 'indo_buscar', label: 'Indo buscar', sublabel: 'A caminho do restaurante', icon: 'store' },
  { key: 'coletado', label: 'Pedido coletado', sublabel: 'Pedido retirado do restaurante', icon: 'inventory' },
  { key: 'a_caminho', label: 'A caminho', sublabel: 'Entregando ao cliente', icon: 'delivery-dining' },
  { key: 'entregue', label: 'Entregue', sublabel: 'Pedido entregue com sucesso!', icon: 'check-circle' },
];

const DEFAULT_COORDS = { latitude: -23.5505, longitude: -46.6333 };

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const { pedidoAtivo, deliveryStatus, avancarStatus, finalizarEntrega } = useDelivery();
  const mapRef = useRef<any>(null);

  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<string | null>(null);
  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickupCoords = pedidoAtivo?.latitude_coleta && pedidoAtivo?.longitude_coleta
    ? { latitude: pedidoAtivo.latitude_coleta, longitude: pedidoAtivo.longitude_coleta }
    : DEFAULT_COORDS;

  const deliveryCoords = pedidoAtivo?.latitude_entrega && pedidoAtivo?.longitude_entrega
    ? { latitude: pedidoAtivo.latitude_entrega, longitude: pedidoAtivo.longitude_entrega }
    : { latitude: pickupCoords.latitude - 0.012, longitude: pickupCoords.longitude + 0.015 };

  const isGoingToRestaurant = deliveryStatus === 'indo_buscar' || deliveryStatus === 'coletado';
  const targetCoords = isGoingToRestaurant ? pickupCoords : deliveryCoords;
  const targetAddress = isGoingToRestaurant
    ? pedidoAtivo?.endereco_coleta ?? ''
    : pedidoAtivo?.endereco_entrega ?? '';

  const updateLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setDriverCoords(coords);

      const dist = haversineDistance(coords.latitude, coords.longitude, targetCoords.latitude, targetCoords.longitude);
      setDistanceToTarget(formatDistance(dist));
    } catch (_) {}
  }, [targetCoords.latitude, targetCoords.longitude]);

  useEffect(() => {
    updateLocation();
    locationTimerRef.current = setInterval(updateLocation, LOCATION_UPDATE_INTERVAL);
    return () => {
      if (locationTimerRef.current) clearInterval(locationTimerRef.current);
    };
  }, [updateLocation]);

  useEffect(() => {
    setDistanceToTarget(null);
    updateLocation();
  }, [deliveryStatus]);

  useEffect(() => {
    if (mapRef.current && pedidoAtivo) {
      setTimeout(() => {
        const coords = [pickupCoords, deliveryCoords];
        if (driverCoords) coords.push(driverCoords);
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 600);
    }
  }, [pedidoAtivo, driverCoords]);

  const midLat = (pickupCoords.latitude + deliveryCoords.latitude) / 2;
  const midLng = (pickupCoords.longitude + deliveryCoords.longitude) / 2;
  const latDelta = Math.abs(pickupCoords.latitude - deliveryCoords.latitude) * 2.5 + 0.015;
  const lngDelta = Math.abs(pickupCoords.longitude - deliveryCoords.longitude) * 2.5 + 0.015;

  if (!pedidoAtivo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="delivery-dining" size={48} color={Colors.textSubtle} />
          <Text style={{ fontSize: FontSize.md, color: Colors.textSubtle, marginTop: Spacing.md }}>Nenhuma entrega ativa</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: Colors.primary, fontWeight: FontWeight.semibold }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepIdx = STEPS.findIndex(s => s.key === deliveryStatus);
  const currentStep = STEPS[currentStepIdx];

  const openNavigation = () => {
    const encodedAddress = encodeURIComponent(targetAddress);
    const { latitude, longitude } = targetCoords;

    const launchNavigator = (idx: number) => {
      const urls: Record<number, string> = {
        0: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
        1: `waze://?ll=${latitude},${longitude}&navigate=yes`,
        2: `maps://?daddr=${latitude},${longitude}`,
      };
      const url = urls[idx];
      if (!url) return;
      Linking.canOpenURL(url).then(supported => {
        Linking.openURL(
          supported ? url : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`
        );
      });
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Google Maps', 'Waze', 'Apple Maps', 'Cancelar'], cancelButtonIndex: 3, title: 'Abrir navegacao em' },
        launchNavigator
      );
    } else {
      Alert.alert('Abrir navegacao', 'Escolha o aplicativo de mapas:', [
        { text: 'Google Maps', onPress: () => launchNavigator(0) },
        { text: 'Waze', onPress: () => launchNavigator(1) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const handleAvancar = () => {
    if (deliveryStatus === 'a_caminho') {
      Alert.alert(
        'Finalizar entrega',
        'Confirma que o pedido foi entregue ao cliente?',
        [
          { text: 'Nao', style: 'cancel' },
          {
            text: 'Sim, finalizar',
            onPress: async () => {
              if (locationTimerRef.current) clearInterval(locationTimerRef.current);
              await finalizarEntrega();
              router.replace('/(tabs)');
            },
          },
        ]
      );
    } else {
      avancarStatus();
    }
  };

  const polylineCoords = driverCoords
    ? [driverCoords, targetCoords]
    : [pickupCoords, deliveryCoords];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Entrega ativa</Text>
        <View style={styles.earningBadge}>
          <Text style={styles.earningText}>R$ {pedidoAtivo.valor_entrega.toFixed(2).replace('.', ',')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
          >
            <Marker coordinate={pickupCoords} title="Restaurante">
              <View style={[styles.markerBox, { backgroundColor: Colors.primary }]}>
                <MaterialIcons name="store" size={18} color="#fff" />
              </View>
            </Marker>
            <Marker coordinate={deliveryCoords} title="Cliente">
              <View style={[styles.markerBox, { backgroundColor: Colors.success }]}>
                <MaterialIcons name="home" size={18} color="#fff" />
              </View>
            </Marker>
            {driverCoords ? (
              <Marker coordinate={driverCoords} title="Voce">
                <View style={[styles.markerBox, { backgroundColor: '#3B82F6' }]}>
                  <MaterialIcons name="two-wheeler" size={18} color="#fff" />
                </View>
              </Marker>
            ) : null}
            <Polyline coordinates={polylineCoords} strokeColor={Colors.primary} strokeWidth={3} />
            <Polyline coordinates={[pickupCoords, deliveryCoords]} strokeColor={Colors.border} strokeWidth={2} lineDashPattern={[5, 5]} />
          </MapView>

          {/* Navigate Button */}
          <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation} activeOpacity={0.85}>
            <MaterialIcons name="navigation" size={18} color="#fff" />
            <Text style={styles.navigateBtnText}>
              {isGoingToRestaurant ? 'Ir ao restaurante' : 'Ir ao cliente'}
            </Text>
          </TouchableOpacity>

          {/* Distance chip */}
          {distanceToTarget ? (
            <View style={styles.distanceChip}>
              <MaterialIcons name="straighten" size={14} color={Colors.textSecondary} />
              <Text style={styles.distanceChipText}>{distanceToTarget}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {/* Current Status Hero */}
          <View style={styles.statusHero}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <View style={[styles.statusIconBox, { backgroundColor: Colors.primary }]}>
                <MaterialIcons name={currentStep.icon as any} size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusHeroTitle}>{currentStep.label}</Text>
                <Text style={styles.statusHeroSub}>{currentStep.sublabel}</Text>
              </View>
            </View>
            {distanceToTarget ? (
              <View style={styles.distancePill}>
                <Text style={styles.distancePillText}>{distanceToTarget}</Text>
              </View>
            ) : null}
          </View>

          {/* Progress Steps */}
          <View style={styles.stepsRow}>
            {STEPS.map((step, idx) => {
              const isDone = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <View key={step.key} style={styles.stepItem}>
                  <View style={styles.stepIconCol}>
                    <View style={[styles.stepDot, isDone && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                      {isDone ? (
                        <MaterialIcons name="check" size={14} color="#fff" />
                      ) : (
                        <Text style={[styles.stepNum, isCurrent && { color: '#fff' }]}>{idx + 1}</Text>
                      )}
                    </View>
                    {idx < STEPS.length - 1 && (
                      <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                    )}
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={[styles.stepLabel, (isDone || isCurrent) && styles.stepLabelActive]}>{step.label}</Text>
                    {isCurrent && <Text style={styles.stepSub}>{step.sublabel}</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Order Info */}
          <View style={styles.orderCard}>
            <Text style={styles.orderCardTitle}>Detalhes do pedido</Text>

            <View style={styles.orderRow}>
              <View style={[styles.orderDot, { backgroundColor: Colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.orderRowLabel}>Restaurante (coleta)</Text>
                <Text style={styles.orderRowValue}>{pedidoAtivo.restaurante_nome}</Text>
                <Text style={styles.orderRowSub}>{pedidoAtivo.endereco_coleta}</Text>
              </View>
            </View>

            <View style={[styles.orderConnector]} />

            <View style={styles.orderRow}>
              <View style={[styles.orderDot, { backgroundColor: Colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.orderRowLabel}>Cliente (entrega)</Text>
                <Text style={styles.orderRowValue}>{pedidoAtivo.cliente_nome}</Text>
                <Text style={styles.orderRowSub}>{pedidoAtivo.endereco_entrega}</Text>
              </View>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{distanceToTarget ?? pedidoAtivo.distancia}</Text>
              <Text style={styles.statLabel}>{distanceToTarget ? 'Ate destino' : 'Distancia'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pedidoAtivo.tempo_estimado}</Text>
              <Text style={styles.statLabel}>Tempo est.</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.success }]}>R$ {pedidoAtivo.valor_entrega.toFixed(2).replace('.', ',')}</Text>
              <Text style={styles.statLabel}>Ganho</Text>
            </View>
          </View>

          {/* Action Button */}
          {deliveryStatus !== 'entregue' && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleAvancar} activeOpacity={0.85}>
              <MaterialIcons
                name={deliveryStatus === 'indo_buscar' ? 'inventory' : deliveryStatus === 'coletado' ? 'delivery-dining' : 'check-circle'}
                size={22}
                color="#fff"
              />
              <Text style={styles.actionBtnText}>
                {deliveryStatus === 'indo_buscar' && 'Marcar como coletado'}
                {deliveryStatus === 'coletado' && 'Iniciar entrega ao cliente'}
                {deliveryStatus === 'a_caminho' && 'Finalizar entrega'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  earningBadge: { backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  earningText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  mapContainer: { position: 'relative', marginBottom: Spacing.md },
  markerBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  navigateBtn: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 10, paddingHorizontal: 16, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  navigateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#fff' },
  distanceChip: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  distanceChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  statusHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 3 },
  statusIconBox: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  statusHeroTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statusHeroSub: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  distancePill: { backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  distancePillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  stepsRow: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  stepItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  stepIconCol: { alignItems: 'center', width: 28 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: Colors.success },
  stepDotCurrent: { backgroundColor: Colors.primary },
  stepNum: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSubtle },
  stepLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2, minHeight: 16 },
  stepLineDone: { backgroundColor: Colors.success },
  stepInfo: { flex: 1, paddingBottom: 12 },
  stepLabel: { fontSize: FontSize.sm, color: Colors.textSubtle, fontWeight: FontWeight.medium },
  stepLabelActive: { color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  stepSub: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  orderCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  orderCardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.md },
  orderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  orderConnector: { width: 2, height: 20, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 4 },
  orderRowLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginBottom: 2 },
  orderRowValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  orderRowSub: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  actionBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  actionBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
});
