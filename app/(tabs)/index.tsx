import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useDelivery } from '@/hooks/useDelivery';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { entregador, updateEntregador } = useAuth();
  const { pedidosDisponiveis, pedidoAtivo, ganhosDia } = useDelivery();

  const isOnline = entregador?.status === 'online';

  const toggleStatus = () => {
    updateEntregador({ status: isOnline ? 'offline' : 'online' });
  };

  const primeiroNome = entregador?.nome?.split(' ')[0] || 'Entregador';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{primeiroNome[0]}</Text>
            </View>
            <View>
              <Text style={styles.headerGreeting}>Ola, {primeiroNome}!</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.online : Colors.offline }]} />
                <Text style={[styles.statusText, { color: isOnline ? Colors.online : Colors.offline }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(tabs)/notifications')}>
            <MaterialIcons name="notifications-none" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Status Toggle Card */}
        <View style={[styles.toggleCard, { backgroundColor: isOnline ? Colors.primary : Colors.surface }]}>
          <View style={styles.toggleCardLeft}>
            <MaterialIcons name={isOnline ? 'wifi' : 'wifi-off'} size={28} color={isOnline ? '#fff' : Colors.textSubtle} style={{ marginRight: 12 }} />
            <View>
              <Text style={[styles.toggleCardTitle, { color: isOnline ? '#fff' : Colors.textPrimary }]}>
                {isOnline ? 'Voce esta disponivel' : 'Voce esta offline'}
              </Text>
              <Text style={[styles.toggleCardSub, { color: isOnline ? 'rgba(255,255,255,0.8)' : Colors.textSubtle }]}>
                {isOnline ? 'Recebendo novos pedidos' : 'Toque para ficar disponivel'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleStatus}
            trackColor={{ false: Colors.border, true: 'rgba(255,255,255,0.4)' }}
            thumbColor={isOnline ? '#fff' : Colors.primary}
          />
        </View>

        {/* Entrega ativa banner */}
        {pedidoAtivo !== null && (
          <TouchableOpacity
            style={styles.activeDeliveryBanner}
            onPress={() => router.push('/active-delivery')}
            activeOpacity={0.85}
          >
            <View style={styles.activePulse} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeBannerTitle}>Entrega em andamento</Text>
              <Text style={styles.activeBannerSub}>{pedidoAtivo.restaurante_nome} - {pedidoAtivo.cliente_nome}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="account-balance-wallet" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>R$ {ganhosDia.toFixed(2).replace('.', ',')}</Text>
            <Text style={styles.statLabel}>Ganhos hoje</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="delivery-dining" size={20} color={Colors.success} />
            <Text style={styles.statValue}>{entregador?.entregas_hoje || 0}</Text>
            <Text style={styles.statLabel}>Entregas hoje</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="receipt-long" size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{pedidosDisponiveis.length}</Text>
            <Text style={styles.statLabel}>Disponiveis</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Acoes rapidas</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/orders')} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.primaryUltraLight }]}>
              <MaterialIcons name="receipt-long" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.actionText}>Ver Pedidos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/earnings')} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.successLight }]}>
              <MaterialIcons name="trending-up" size={26} color={Colors.success} />
            </View>
            <Text style={styles.actionText}>Meus Ganhos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.surfaceSecondary }]}>
              <MaterialIcons name="person" size={26} color={Colors.textSecondary} />
            </View>
            <Text style={styles.actionText}>Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tipCard}>
          <MaterialIcons name="lightbulb" size={20} color={Colors.warning} />
          <Text style={styles.tipText}>
            Fique online nos horarios de pico para receber mais pedidos e aumentar seus ganhos!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBox: { width: 46, height: 46, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff' },
  headerGreeting: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  notifBtn: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  toggleCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  toggleCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  toggleCardSub: { fontSize: FontSize.xs, marginTop: 2 },
  activeDeliveryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, gap: 10 },
  activePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  activeBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
  activeBannerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 6 },
  statLabel: { fontSize: 11, color: Colors.textSubtle, marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  actionIcon: { width: 50, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  actionText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textAlign: 'center' },
  tipCard: { flexDirection: 'row', backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md, gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: FontSize.sm, color: '#92400E', lineHeight: 20 },
});
