import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDelivery } from '@/hooks/useDelivery';
import { useAuth } from '@/hooks/useAuth';
import { Pedido } from '@/contexts/DeliveryContext';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

const TIMER_DURATION = 30;

function useOrderTimer(
  order: Pedido | null,
  onExpire: (id: string) => void
): number {
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!order) {
      setTimeLeft(TIMER_DURATION);
      currentOrderId.current = null;
      return;
    }

    // New order — reset timer
    if (order.id !== currentOrderId.current) {
      currentOrderId.current = order.id;
      setTimeLeft(TIMER_DURATION);
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          const expiredId = currentOrderId.current;
          if (expiredId) {
            setTimeout(() => onExpire(expiredId), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [order?.id]);

  return timeLeft;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { pedidoAtual, totalDisponiveis, pedidoAtivo, aceitarPedido, recusarPedido, isLoadingOrders, refreshOrders } = useDelivery();
  const { entregador } = useAuth();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isOnline = entregador?.status === 'online';

  const handleTimerExpire = useCallback((orderId: string) => {
    recusarPedido(orderId);
  }, [recusarPedido]);

  const timeLeft = useOrderTimer(isOnline ? pedidoAtual : null, handleTimerExpire);
  const isUrgent = timeLeft <= 10;

  // Pulse animation on urgent
  useEffect(() => {
    if (isUrgent && pedidoAtual) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 300, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isUrgent, pedidoAtual?.id]);

  const handleAceitar = useCallback(() => {
    if (!pedidoAtual) return;
    if (pedidoAtivo) {
      return;
    }
    aceitarPedido(pedidoAtual.id);
    router.push('/active-delivery');
  }, [pedidoAtual, pedidoAtivo, aceitarPedido, router]);

  const handleRecusar = useCallback(() => {
    if (!pedidoAtual) return;
    recusarPedido(pedidoAtual.id);
  }, [pedidoAtual, recusarPedido]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pedidos</Text>
        <View style={[styles.countBadge, { backgroundColor: totalDisponiveis > 0 ? Colors.primaryUltraLight : Colors.surfaceSecondary }]}>
          <Text style={[styles.countText, { color: totalDisponiveis > 0 ? Colors.primary : Colors.textSubtle }]}>
            {totalDisponiveis} na fila
          </Text>
        </View>
      </View>

      {/* Entrega ativa — bloqueia novos pedidos */}
      {pedidoAtivo !== null && (
        <TouchableOpacity style={styles.activeDeliveryBanner} onPress={() => router.push('/active-delivery')} activeOpacity={0.85}>
          <View style={styles.activePulse} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Entrega em andamento</Text>
            <Text style={styles.activeBannerSub}>Finalize antes de aceitar um novo pedido</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {!isOnline ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="wifi-off" size={56} color={Colors.textSubtle} />
          <Text style={styles.emptyTitle}>Voce esta offline</Text>
          <Text style={styles.emptyText}>Fique online na tela inicial para receber pedidos</Text>
        </View>
      ) : !pedidoAtual ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={56} color={Colors.textSubtle} />
          <Text style={styles.emptyTitle}>Nenhum pedido disponivel</Text>
          <Text style={styles.emptyText}>Aguardando novos pedidos na sua regiao...</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={refreshOrders}>
            <MaterialIcons name="refresh" size={18} color={Colors.primary} />
            <Text style={styles.refreshBtnText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.orderContent}>
          {/* Timer ring */}
          <View style={styles.timerSection}>
            <View style={[styles.timerRing, { borderColor: isUrgent ? Colors.error : Colors.primary }]}>
              <Text style={[styles.timerNumber, { color: isUrgent ? Colors.error : Colors.primary }]}>{timeLeft}</Text>
              <Text style={styles.timerLabel}>seg</Text>
            </View>
            <View style={styles.timerBarTrack}>
              <View style={[styles.timerBarFill, {
                width: `${(timeLeft / TIMER_DURATION) * 100}%`,
                backgroundColor: isUrgent ? Colors.error : Colors.primary
              }]} />
            </View>
            <Text style={[styles.timerMsg, { color: isUrgent ? Colors.error : Colors.textSubtle }]}>
              {isUrgent ? 'Pedido expirando!' : 'Responda antes do tempo acabar'}
            </Text>
          </View>

          {/* Order Card */}
          <Animated.View style={[styles.orderCard, { transform: [{ scale: pulseAnim }] }]}>
            {/* Restaurant */}
            <View style={styles.restauranteRow}>
              <View style={styles.restauranteIcon}>
                <MaterialIcons name="store" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restauranteNome}>{pedidoAtual.restaurante_nome}</Text>
                <Text style={styles.pedidoId}>Pedido #{pedidoAtual.id.slice(0, 8)}</Text>
              </View>
              <View style={styles.valorBadge}>
                <Text style={styles.valorText}>R$ {pedidoAtual.valor_entrega.toFixed(2).replace('.', ',')}</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialIcons name="straighten" size={16} color={Colors.textSubtle} />
                <Text style={styles.statText}>{pedidoAtual.distancia}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialIcons name="access-time" size={16} color={Colors.textSubtle} />
                <Text style={styles.statText}>{pedidoAtual.tempo_estimado}</Text>
              </View>
            </View>

            {/* Addresses */}
            <View style={styles.addressesBox}>
              <View style={styles.addressRow}>
                <View style={[styles.addressPin, { backgroundColor: Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>Coleta</Text>
                  <Text style={styles.addressValue} numberOfLines={2}>{pedidoAtual.endereco_coleta}</Text>
                </View>
              </View>
              <View style={styles.addressConnector} />
              <View style={styles.addressRow}>
                <View style={[styles.addressPin, { backgroundColor: Colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>Entrega para {pedidoAtual.cliente_nome}</Text>
                  <Text style={styles.addressValue} numberOfLines={2}>{pedidoAtual.endereco_entrega}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnRecusar, pedidoAtivo ? styles.btnDisabled : null]}
              onPress={handleRecusar}
              activeOpacity={0.8}
              disabled={!!pedidoAtivo}
            >
              <MaterialIcons name="close" size={20} color={pedidoAtivo ? Colors.textSubtle : Colors.error} />
              <Text style={[styles.btnRecusarText, pedidoAtivo ? { color: Colors.textSubtle } : null]}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnAceitar, pedidoAtivo ? styles.btnDisabled : null]}
              onPress={handleAceitar}
              activeOpacity={0.85}
              disabled={!!pedidoAtivo}
            >
              <MaterialIcons name="check" size={20} color={pedidoAtivo ? Colors.textSubtle : '#fff'} />
              <Text style={[styles.btnAceitarText, pedidoAtivo ? { color: Colors.textSubtle } : null]}>Aceitar e ir</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  countBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  countText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  activeDeliveryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success, borderRadius: Radius.md, marginHorizontal: Spacing.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: 10 },
  activePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  activeBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
  activeBannerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.md, textAlign: 'center' },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSubtle, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.primaryUltraLight },
  refreshBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },
  orderContent: { flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  timerSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  timerRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  timerNumber: { fontSize: 32, fontWeight: FontWeight.extrabold, lineHeight: 36 },
  timerLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: -2 },
  timerBarTrack: { width: '60%', height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: Spacing.sm },
  timerBarFill: { height: 4, borderRadius: 2 },
  timerMsg: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  orderCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 5 },
  restauranteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  restauranteIcon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  restauranteNome: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pedidoId: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  valorBadge: { backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  valorText: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, color: Colors.primary },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  statDivider: { width: 1, height: 20, backgroundColor: Colors.border },
  statText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  addressesBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.md },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressPin: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  addressLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginBottom: 2 },
  addressValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  addressConnector: { width: 2, height: 16, backgroundColor: Colors.border, marginLeft: 4, marginVertical: 4 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  btnRecusar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.lg, paddingVertical: 16 },
  btnRecusarText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.error },
  btnAceitar: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 16 },
  btnAceitarText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#fff' },
  btnDisabled: { borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
});
