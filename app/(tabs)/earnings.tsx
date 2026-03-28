import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useDelivery } from '@/hooks/useDelivery';
import { HistoricoEntrega } from '@/contexts/DeliveryContext';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

type Periodo = 'hoje' | 'semana';

const SCREEN_WIDTH = Dimensions.get('window').width;

function getLast7Days(): { label: string; date: string }[] {
  const days = [];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: i === 0 ? 'Hoje' : dayNames[d.getDay()],
      date: d.toISOString().split('T')[0],
    });
  }
  return days;
}

function WeekBarChart({ historico }: { historico: HistoricoEntrega[] }) {
  const days = getLast7Days();
  const earningsByDay = days.map(({ date }) => {
    return historico.filter(h => h.data === date).reduce((sum, h) => sum + h.valor, 0);
  });
  const maxEarning = Math.max(...earningsByDay, 1);
  const maxIdx = earningsByDay.indexOf(Math.max(...earningsByDay));
  const BAR_MAX_HEIGHT = 100;
  const chartWidth = SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2;
  const barWidth = Math.floor((chartWidth - 6 * 8) / 7);

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.header}>
        <Text style={chartStyles.title}>Ganhos dos ultimos 7 dias</Text>
        {maxEarning > 0 && (
          <View style={chartStyles.bestDayBadge}>
            <MaterialIcons name="star" size={12} color={Colors.primary} />
            <Text style={chartStyles.bestDayText}>Melhor: {days[maxIdx].label}</Text>
          </View>
        )}
      </View>
      <View style={chartStyles.barsRow}>
        {earningsByDay.map((val, idx) => {
          const isMax = idx === maxIdx && val > 0;
          const isToday = idx === 6;
          const barHeight = val > 0 ? Math.max(8, (val / maxEarning) * BAR_MAX_HEIGHT) : 4;
          return (
            <View key={idx} style={[chartStyles.barCol, { width: barWidth }]}>
              {val > 0 && <Text style={chartStyles.barValue}>{val.toFixed(0)}</Text>}
              <View style={chartStyles.barTrack}>
                <View style={[chartStyles.bar, { height: barHeight }, isMax && chartStyles.barMax, isToday && !isMax && chartStyles.barToday]} />
              </View>
              <Text style={chartStyles.barLabel}>{days[idx].label}</Text>
            </View>
          );
        })}
      </View>
      {maxEarning === 0 && (
        <View style={chartStyles.emptyOverlay}>
          <Text style={chartStyles.emptyText}>Sem entregas nos ultimos 7 dias</Text>
        </View>
      )}
      <View style={chartStyles.referenceLines}>
        <View style={chartStyles.refLine} />
        <View style={chartStyles.refLine} />
        <View style={chartStyles.refLine} />
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 3, position: 'relative', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  bestDayBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  bestDayText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130, paddingBottom: 4 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.textSubtle, marginBottom: 2 },
  barTrack: { flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '80%', borderRadius: 4, backgroundColor: Colors.border, minHeight: 4 },
  barMax: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  barToday: { backgroundColor: Colors.primaryLight },
  barLabel: { fontSize: 10, color: Colors.textSubtle, fontWeight: FontWeight.medium, marginTop: 4 },
  emptyOverlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  emptyText: { fontSize: FontSize.xs, color: Colors.textSubtle, fontStyle: 'italic' },
  referenceLines: { position: 'absolute', top: 52, left: Spacing.md, right: Spacing.md, height: 100, justifyContent: 'space-between' },
  refLine: { height: 1, backgroundColor: Colors.borderLight, width: '100%' },
});

export default function EarningsScreen() {
  const { ganhosDia, ganhosSemana, historico } = useDelivery();
  const [periodo, setPeriodo] = useState<Periodo>('hoje');

  const hoje = new Date().toISOString().split('T')[0];
  const historicoFiltrado = periodo === 'hoje'
    ? historico.filter(h => h.data === hoje)
    : historico;

  const totalEntregas = historicoFiltrado.length;
  const totalKm = historicoFiltrado.reduce((sum, h) => {
    const km = parseFloat(h.distancia.replace(',', '.').replace(' km', ''));
    return sum + (isNaN(km) ? 0 : km);
  }, 0);

  const renderHistorico = ({ item }: { item: HistoricoEntrega }) => {
    const data = new Date(item.data + 'T12:00:00');
    const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return (
      <View style={styles.historicoCard}>
        <View style={styles.historicoIcon}>
          <MaterialIcons name="check-circle" size={22} color={Colors.success} />
        </View>
        <View style={styles.historicoInfo}>
          <Text style={styles.historicoRestaurante}>{item.restaurante_nome}</Text>
          <View style={styles.historicoMeta}>
            <Text style={styles.historicoData}>{dataFormatada}</Text>
            <Text style={styles.historicoDot}>•</Text>
            <Text style={styles.historicoDistancia}>{item.distancia}</Text>
          </View>
        </View>
        <Text style={styles.historicoValor}>R$ {item.valor.toFixed(2).replace('.', ',')}</Text>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Ganhos</Text>
      </View>

      <View style={styles.periodoSelector}>
        {(['hoje', 'semana'] as Periodo[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodoBtn, periodo === p && styles.periodoBtnActive]}
            onPress={() => setPeriodo(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodoBtnText, periodo === p && styles.periodoBtnTextActive]}>
              {p === 'hoje' ? 'Hoje' : 'Esta semana'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.gainhosHero}>
        <Text style={styles.gainhosLabel}>Total ganho</Text>
        <Text style={styles.gainhosValue}>
          R$ {(periodo === 'hoje' ? ganhosDia : ganhosSemana).toFixed(2).replace('.', ',')}
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{totalEntregas}</Text>
            <Text style={styles.heroStatLabel}>Entregas</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{totalKm.toFixed(1).replace('.', ',')} km</Text>
            <Text style={styles.heroStatLabel}>Percorridos</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>
              R$ {totalEntregas > 0
                ? ((periodo === 'hoje' ? ganhosDia : ganhosSemana) / totalEntregas).toFixed(2).replace('.', ',')
                : '0,00'}
            </Text>
            <Text style={styles.heroStatLabel}>Por entrega</Text>
          </View>
        </View>
      </View>

      <WeekBarChart historico={historico} />

      <Text style={styles.historicoTitle}>
        Historico {periodo === 'hoje' ? 'de hoje' : 'da semana'}
      </Text>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={historicoFiltrado}
        keyExtractor={item => item.id}
        renderItem={renderHistorico}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={40} color={Colors.textSubtle} />
            <Text style={styles.emptyText}>
              Nenhuma entrega {periodo === 'hoje' ? 'hoje' : 'nesta semana'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { paddingBottom: Spacing.xxl },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  periodoSelector: { flexDirection: 'row', marginHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 4, marginBottom: Spacing.md },
  periodoBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm },
  periodoBtnActive: { backgroundColor: Colors.primary },
  periodoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSubtle },
  periodoBtnTextActive: { color: '#fff' },
  gainhosHero: { marginHorizontal: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, alignItems: 'center' },
  gainhosLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  gainhosValue: { fontSize: 40, fontWeight: FontWeight.extrabold, color: '#fff', marginBottom: Spacing.lg },
  heroStats: { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.md, paddingVertical: Spacing.md },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroStatValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  heroStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  historicoTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  historicoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  historicoIcon: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  historicoInfo: { flex: 1 },
  historicoRestaurante: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  historicoMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  historicoData: { fontSize: FontSize.xs, color: Colors.textSubtle },
  historicoDot: { fontSize: FontSize.xs, color: Colors.textSubtle },
  historicoDistancia: { fontSize: FontSize.xs, color: Colors.textSubtle },
  historicoValor: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSubtle },
});
