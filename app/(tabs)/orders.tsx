import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDelivery } from '@/hooks/useDelivery';
import { useAuth } from '@/hooks/useAuth';
import { Pedido } from '@/contexts/DeliveryContext';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

const TIMER_DURATION = 30;

function useOrderTimers(
  orders: Pedido[],
  onExpire: (id: string) => void
): Record<string, number> {
  const [timers, setTimers] = useState<Record<string, number>>({});
  const timerRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const trackedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    orders.forEach(order => {
      if (!trackedIds.current.has(order.id)) {
        trackedIds.current.add(order.id);
        setTimers(prev => ({ ...prev, [order.id]: TIMER_DURATION }));

        const interval = setInterval(() => {
          setTimers(prev => {
            const current = prev[order.id];
            if (current === undefined || current <= 1) {
              clearInterval(timerRefs.current[order.id]);
              delete timerRefs.current[order.id];
              onExpire(order.id);
              const next = { ...prev };
              delete next[order.id];
              return next;
            }
            return { ...prev, [order.id]: current - 1 };
          });
        }, 1000);

        timerRefs.current[order.id] = interval;
      }
    });

    const currentIds = new Set(orders.map(o => o.id));
    trackedIds.current.forEach(id => {
      if (!currentIds.has(id)) {
        if (timerRefs.current[id]) {
          clearInterval(timerRefs.current[id]);
          delete timerRefs.current[id];
        }
        trackedIds.current.delete(id);
        setTimers(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [orders]);

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearInterval);
    };
  }, []);

  return timers;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { pedidosDisponiveis, pedidoAtivo, aceitarPedido, recusarPedido, isLoadingOrders, refreshOrders } = useDelivery();
  const { entregador } = useAuth();
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  const isOnline = entregador?.status === 'online';

  const handleTimerExpire = (orderId: string) => {
    recusarPedido(orderId);
    if (selectedPedido?.id === orderId) {
      setSelectedPedido(null);
    }
  };

  const timers = useOrderTimers(isOnline ? pedidosDisponiveis : [], handleTimerExpire);

  const handleAceitar = (pedidoId: string) => {
    if (pedidoAtivo) {
      Alert.alert('Entrega em andamento', 'Finalize a entrega atual antes de aceitar um novo pedido.');
      return;
    }
    aceitarPedido(pedidoId);
    setSelectedPedido(null);
    router.push('/active-delivery');
  };

  const handleRecusar = (pedidoId: string) => {
    recusarPedido(pedidoId);
    setSelectedPedido(null);
  };

  const renderPedido = ({ item }: { item: Pedido }) => {
    const timeLeft = timers[item.id] ?? TIMER_DURATION;
    const isUrgent = timeLeft <= 10;

    return (
      <TouchableOpacity
        style={[styles.pedidoCard, isUrgent && styles.pedidoCardUrgent]}
        onPress={() => setSelectedPedido(item)}
        activeOpacity={0.85}
      >
        <View style={styles.pedidoHeader}>
          <View style={styles.restauranteInfo}>
            <View style={styles.restauranteIcon}>
              <MaterialIcons name="store" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.restauranteNome}>{item.restaurante_nome}</Text>
              <Text style={styles.pedidoId}>Pedido #{item.id.slice(0, 8)}</Text>
            </View>
          </View>
          <View style={[{ width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: isUrgent ? Colors.error : Colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: isUrgent ? Colors.error : Colors.primary }}>{timeLeft}</Text>
          </View>
        </View>

        {/* Timer bar */}
        <View style={styles.timerBarTrack}>
          <View style={[styles.timerBarFill, { width: `${(timeLeft / TIMER_DURATION) * 100}%`, backgroundColor: isUrgent ? Colors.error : Colors.primary }]} />
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="straighten" size={14} color={Colors.textSubtle} />
            <Text style={styles.infoText}>{item.distancia}</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="access-time" size={14} color={Colors.textSubtle} />
            <Text style={styles.infoText}>{item.tempo_estimado}</Text>
          </View>
          <View style={styles.valorBadge}>
            <Text style={styles.valorText}>R$ {item.valor_entrega.toFixed(2).replace('.', ',')}</Text>
          </View>
        </View>

        <View style={styles.enderecoRow}>
          <View style={styles.enderecoItem}>
            <View style={[styles.enderecoPin, { backgroundColor: Colors.primary }]} />
            <Text style={styles.enderecoText} numberOfLines={1}>{item.endereco_coleta}</Text>
          </View>
          <View style={styles.enderecoArrow}>
            <MaterialIcons name="arrow-downward" size={14} color={Colors.textSubtle} />
          </View>
          <View style={styles.enderecoItem}>
            <View style={[styles.enderecoPin, { backgroundColor: Colors.success }]} />
            <Text style={styles.enderecoText} numberOfLines={1}>{item.endereco_entrega}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.btnRecusar} onPress={() => handleRecusar(item.id)} activeOpacity={0.8}>
            <MaterialIcons name="close" size={16} color={Colors.error} />
            <Text style={styles.btnRecusarText}>Recusar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAceitar} onPress={() => handleAceitar(item.id)} activeOpacity={0.85}>
            <MaterialIcons name="check" size={16} color="#fff" />
            <Text style={styles.btnAceitarText}>Aceitar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pedidos</Text>
        <View style={[styles.countBadge, { backgroundColor: pedidosDisponiveis.length > 0 ? Colors.primaryUltraLight : Colors.surfaceSecondary }]}>
          <Text style={[styles.countText, { color: pedidosDisponiveis.length > 0 ? Colors.primary : Colors.textSubtle }]}>
            {pedidosDisponiveis.length} disponivel{pedidosDisponiveis.length !== 1 ? 'is' : ''}
          </Text>
        </View>
      </View>

      {!isOnline ? (
        <View style={styles.offlineState}>
          <MaterialIcons name="wifi-off" size={56} color={Colors.textSubtle} />
          <Text style={styles.offlineTitle}>Voce esta offline</Text>
          <Text style={styles.offlineText}>Fique online na tela inicial para receber pedidos</Text>
        </View>
      ) : pedidosDisponiveis.length === 0 ? (
        <View style={styles.offlineState}>
          <MaterialIcons name="search-off" size={56} color={Colors.textSubtle} />
          <Text style={styles.offlineTitle}>Nenhum pedido disponivel</Text>
          <Text style={styles.offlineText}>Aguardando novos pedidos na sua regiao...</Text>
        </View>
      ) : (
        <FlatList
          data={pedidosDisponiveis}
          keyExtractor={item => item.id}
          renderItem={renderPedido}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoadingOrders} onRefresh={refreshOrders} tintColor={Colors.primary} />
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={selectedPedido !== null} transparent animationType="slide" onRequestClose={() => setSelectedPedido(null)}>
        {selectedPedido !== null && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalRestaurante}>{selectedPedido.restaurante_nome}</Text>
                  <Text style={styles.modalPedidoId}>Pedido #{selectedPedido.id.slice(0, 8)}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.primary }}>{timers[selectedPedido.id] ?? 0}</Text>
                  <Text style={{ fontSize: FontSize.xs, color: Colors.textSubtle }}>seg</Text>
                </View>
              </View>

              {/* Timer bar */}
              <View style={[styles.timerBarTrack, { marginBottom: Spacing.md }]}>
                <View style={[styles.timerBarFill, {
                  width: `${((timers[selectedPedido.id] ?? 0) / TIMER_DURATION) * 100}%`,
                  backgroundColor: (timers[selectedPedido.id] ?? 0) <= 10 ? Colors.error : Colors.primary
                }]} />
              </View>

              <View style={styles.modalValorRow}>
                <Text style={styles.modalValorLabel}>Valor da entrega</Text>
                <Text style={styles.modalValor}>R$ {selectedPedido.valor_entrega.toFixed(2).replace('.', ',')}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
                {[
                  { icon: 'place', label: 'Distancia', value: selectedPedido.distancia },
                  { icon: 'access-time', label: 'Tempo est.', value: selectedPedido.tempo_estimado },
                ].map((item, i) => (
                  <View key={i} style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>{item.value}</Text>
                    <Text style={styles.modalStatLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.modalAddresses}>
                <View style={styles.modalAddrRow}>
                  <View style={[styles.enderecoPin, { backgroundColor: Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalAddrLabel}>Coleta</Text>
                    <Text style={styles.modalAddrValue}>{selectedPedido.endereco_coleta}</Text>
                  </View>
                </View>
                <View style={{ width: 2, height: 16, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 4 }} />
                <View style={styles.modalAddrRow}>
                  <View style={[styles.enderecoPin, { backgroundColor: Colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalAddrLabel}>Entrega para {selectedPedido.cliente_nome}</Text>
                    <Text style={styles.modalAddrValue}>{selectedPedido.endereco_entrega}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.btnRecusar} onPress={() => handleRecusar(selectedPedido.id)} activeOpacity={0.8}>
                  <Text style={styles.btnRecusarText}>Recusar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnAceitar} onPress={() => handleAceitar(selectedPedido.id)} activeOpacity={0.85}>
                  <Text style={styles.btnAceitarText}>Aceitar e ir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  countBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  countText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  offlineState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  offlineTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.md, textAlign: 'center' },
  offlineText: { fontSize: FontSize.sm, color: Colors.textSubtle, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  pedidoCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 3, borderWidth: 1.5, borderColor: 'transparent' },
  pedidoCardUrgent: { borderColor: Colors.error },
  pedidoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  restauranteInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  restauranteIcon: { width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  restauranteNome: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  pedidoId: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 1 },
  timerBarTrack: { height: 3, backgroundColor: Colors.border, borderRadius: 2, marginBottom: Spacing.sm, overflow: 'hidden' },
  timerBarFill: { height: 3, borderRadius: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: FontSize.sm, color: Colors.textSubtle },
  valorBadge: { marginLeft: 'auto', backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  valorText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  enderecoRow: { marginBottom: Spacing.md },
  enderecoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enderecoPin: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  enderecoText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  enderecoArrow: { paddingLeft: 3, marginVertical: 3 },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  btnRecusar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.md, paddingVertical: 12 },
  btnRecusarText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },
  btnAceitar: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12 },
  btnAceitarText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalRestaurante: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalPedidoId: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  modalValorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primaryUltraLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  modalValorLabel: { fontSize: FontSize.sm, color: Colors.textSubtle },
  modalValor: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  modalStatItem: { flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  modalStatValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalStatLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 },
  modalAddresses: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  modalAddrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalAddrLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginBottom: 2 },
  modalAddrValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
});
