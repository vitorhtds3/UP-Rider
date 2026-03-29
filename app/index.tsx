import { Redirect } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function Index() {
  const { isAuthenticated, isLoading, entregador, logout } = useAuth();

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
          <MaterialIcons name="hourglass-empty" size={40} color={Colors.warning} />
        </View>
        <Text style={styles.pendingTitle}>Cadastro em analise</Text>
        <Text style={styles.pendingText}>
          Seu cadastro foi recebido e esta sendo analisado pela nossa equipe. Voce sera notificado assim que for aprovado.
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
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
    marginBottom: Spacing.xl,
  },
  logoutBtn: {
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
