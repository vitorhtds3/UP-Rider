import { Redirect } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function Index() {
  const { isAuthenticated, isLoading, entregador, logout, refreshUserData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleCheckStatus = async () => {
    setRefreshing(true);
    await refreshUserData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.pendingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (isAuthenticated && entregador?.accountStatus === 'pending') {
    return (
      <View style={styles.pendingContainer}>
        <View style={styles.pendingIconBox}>
          <MaterialIcons name="hourglass-empty" size={44} color={Colors.warning} />
        </View>

        <Text style={styles.pendingTitle}>Cadastro em analise</Text>
        <Text style={styles.pendingText}>
          Seu cadastro foi recebido e esta sendo analisado pela nossa equipe. Voce sera notificado assim que for aprovado.
        </Text>

        <View style={styles.infoBox}>
          <MaterialIcons name="schedule" size={16} color={Colors.warning} />
          <Text style={styles.infoText}>O processo de aprovacao leva ate 48 horas uteis.</Text>
        </View>

        <View style={styles.driverSummary}>
          <View style={styles.driverRow}>
            <MaterialIcons name="person" size={16} color={Colors.textSubtle} />
            <Text style={styles.driverLabel}>Nome:</Text>
            <Text style={styles.driverValue}>{entregador.nome || '-'}</Text>
          </View>
          <View style={styles.driverRow}>
            <MaterialIcons name="email" size={16} color={Colors.textSubtle} />
            <Text style={styles.driverLabel}>Email:</Text>
            <Text style={styles.driverValue}>{entregador.email || '-'}</Text>
          </View>
          <View style={styles.driverRow}>
            <MaterialIcons name="two-wheeler" size={16} color={Colors.textSubtle} />
            <Text style={styles.driverLabel}>Veiculo:</Text>
            <Text style={styles.driverValue}>{entregador.veiculo || '-'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkBtn, refreshing && styles.checkBtnDisabled]}
          onPress={handleCheckStatus}
          disabled={refreshing}
          activeOpacity={0.85}
        >
          {refreshing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.checkBtnText}>Verificar aprovacao</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <MaterialIcons name="logout" size={16} color={Colors.textSecondary} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  pendingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  pendingIconBox: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: Colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  pendingTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  infoText: {
    fontSize: FontSize.sm,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
  driverSummary: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
    width: 60,
  },
  driverValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    flex: 1,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    width: '100%',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkBtnDisabled: {
    opacity: 0.7,
  },
  checkBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
  },
  logoutText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
});
