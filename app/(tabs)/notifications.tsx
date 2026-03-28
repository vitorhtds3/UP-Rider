import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification } from '@/contexts/NotificationsContext';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  order: { icon: 'local-shipping', color: Colors.primary, bg: Colors.primaryUltraLight },
  status: { icon: 'update', color: '#8B5CF6', bg: '#F3E8FF' },
  payment: { icon: 'account-balance-wallet', color: Colors.success, bg: Colors.successLight },
  alert: { icon: 'warning-amber', color: '#F59E0B', bg: '#FEF3C7' },
  default: { icon: 'notifications', color: Colors.textSubtle, bg: Colors.surfaceSecondary },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.default;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins} min atras`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atras`;
  const days = Math.floor(hrs / 24);
  return `${days}d atras`;
}

export default function NotificationsScreen() {
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const cfg = getTypeConfig(item.type);
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => { if (!item.read) markAsRead(item.id); }}
        activeOpacity={0.85}
      >
        <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notificacoes</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>{unreadCount} nao lida{unreadCount !== 1 ? 's' : ''}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
            <MaterialIcons name="done-all" size={14} color={Colors.primary} />
            <Text style={styles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <MaterialIcons name="notifications-none" size={40} color={Colors.textSubtle} />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma notificacao</Text>
              <Text style={styles.emptyText}>As notificacoes de pedidos e atualizacoes aparecerao aqui.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, marginTop: 2 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: Colors.primaryUltraLight, borderRadius: Radius.full },
  markAllText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2, position: 'relative' },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  iconBox: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, flexShrink: 0 },
  cardContent: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, flex: 1, marginRight: 8 },
  cardTitleUnread: { fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardTime: { fontSize: FontSize.xs, color: Colors.textSubtle, flexShrink: 0 },
  cardMessage: { fontSize: FontSize.xs, color: Colors.textSubtle, lineHeight: 18 },
  unreadDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyIconBox: { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSubtle, textAlign: 'center', lineHeight: 20 },
});
