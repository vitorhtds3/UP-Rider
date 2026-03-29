import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { entregador, logout, updateEntregador } = useAuth();
  const [editModal, setEditModal] = useState(false);
  const [editNome, setEditNome] = useState(entregador?.nome || '');
  const [editTelefone, setEditTelefone] = useState(entregador?.telefone || '');
  const [editVeiculo, setEditVeiculo] = useState(entregador?.veiculo || '');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Logout confirm sheet (replaces Alert.alert — blocked in iframes)
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSalvar = () => {
    updateEntregador({ nome: editNome, telefone: editTelefone, veiculo: editVeiculo });
    setEditModal(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
    setLogoutConfirm(false);
    router.replace('/login');
  };

  const iniciais = entregador?.nome?.split(' ').slice(0, 2).map(n => n[0]).join('') || 'E';

  const AccountStatusRow = ({ status }: { status?: string }) => {
    const config = {
      active: { color: Colors.success, bg: Colors.successLight, label: 'Conta ativa', desc: 'Aprovada e pronta para entregas' },
      pending: { color: Colors.warning, bg: Colors.warningLight, label: 'Em analise', desc: 'Aguardando aprovacao da equipe' },
      suspended: { color: Colors.error, bg: Colors.errorLight, label: 'Conta suspensa', desc: 'Entre em contato com o suporte' },
      rejected: { color: Colors.error, bg: Colors.errorLight, label: 'Cadastro recusado', desc: 'Seu cadastro nao foi aprovado' },
    };
    const current = config[status as keyof typeof config] || config.pending;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.sm, backgroundColor: current.bg, borderRadius: Radius.md, padding: Spacing.sm, marginTop: 4 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: current.color }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoValue, { color: current.color }]}>{current.label}</Text>
          <Text style={styles.infoLabel}>{current.desc}</Text>
        </View>
      </View>
    );
  };

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon as any} size={20} color={Colors.textSubtle} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
        </View>

        {/* Saved feedback banner */}
        {savedFeedback && (
          <View style={styles.savedBanner}>
            <MaterialIcons name="check-circle" size={18} color={Colors.success} />
            <Text style={styles.savedBannerText}>Perfil atualizado com sucesso!</Text>
          </View>
        )}

        {/* Avatar Hero */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{iniciais}</Text>
          </View>
          <Text style={styles.heroNome}>{entregador?.nome}</Text>
          <Text style={styles.heroEmail}>{entregador?.email}</Text>
          <View style={styles.idBadge}>
            <Text style={styles.idBadgeText}>ID #{entregador?.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Informacoes pessoais */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informacoes pessoais</Text>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditNome(entregador?.nome || '');
                setEditTelefone(entregador?.telefone || '');
                setEditVeiculo(entregador?.veiculo || '');
                setEditModal(true);
              }}
            >
              <MaterialIcons name="edit" size={16} color={Colors.primary} />
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          </View>
          <InfoRow icon="person" label="Nome" value={entregador?.nome || '-'} />
          <InfoRow icon="email" label="Email" value={entregador?.email || '-'} />
          <InfoRow icon="phone" label="Telefone" value={entregador?.telefone || '-'} />
        </View>

        {/* Veiculo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veiculo</Text>
          <InfoRow icon="two-wheeler" label="Tipo" value={entregador?.veiculo || '-'} />
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status da conta</Text>
          <AccountStatusRow status={entregador?.accountStatus} />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setLogoutConfirm(true)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>UP Rider v1.0.0</Text>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar perfil</Text>
                <TouchableOpacity onPress={() => setEditModal(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {[
                { label: 'Nome completo', value: editNome, setter: setEditNome, icon: 'person' },
                { label: 'Telefone', value: editTelefone, setter: setEditTelefone, icon: 'phone' },
                { label: 'Tipo de veiculo', value: editVeiculo, setter: setEditVeiculo, icon: 'two-wheeler' },
              ].map((field, i) => (
                <View key={i} style={styles.editInputGroup}>
                  <Text style={styles.editInputLabel}>{field.label}</Text>
                  <View style={styles.editInputWrapper}>
                    <MaterialIcons name={field.icon as any} size={20} color={Colors.textSubtle} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.editInput}
                      value={field.value}
                      onChangeText={field.setter}
                      placeholderTextColor={Colors.textSubtle}
                      accessibilityLabel={field.label}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.salvarBtn} onPress={handleSalvar} activeOpacity={0.85}>
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.salvarBtnText}>Salvar alteracoes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Logout Confirm Sheet (replaces Alert — blocked in iframes) */}
      {logoutConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <View style={styles.confirmIconBox}>
              <MaterialIcons name="logout" size={36} color={Colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Sair da conta</Text>
            <Text style={styles.confirmText}>Tem certeza que deseja sair? Voce precisara entrar novamente.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setLogoutConfirm(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtnLogout, isLoggingOut && { opacity: 0.7 }]}
                onPress={handleConfirmLogout}
                disabled={isLoggingOut}
              >
                <Text style={styles.confirmBtnLogoutText}>
                  {isLoggingOut ? 'Saindo...' : 'Sair'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.xxl },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  savedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successLight, borderRadius: Radius.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  savedBannerText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.semibold },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  avatarBox: { width: 90, height: 90, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  avatarText: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: '#fff' },
  heroNome: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  heroEmail: { fontSize: FontSize.sm, color: Colors.textSubtle, marginBottom: Spacing.sm },
  idBadge: { backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  idBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  section: { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.md, padding: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoIcon: { marginRight: Spacing.sm },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, marginBottom: 2 },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.lg, borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.lg, paddingVertical: 16, gap: 8, marginBottom: Spacing.md },
  logoutText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.error },
  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textSubtle },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  editInputGroup: { marginBottom: Spacing.md },
  editInputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: 6 },
  editInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 52 },
  editInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, includeFontPadding: false },
  salvarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 56, marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  salvarBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },

  // Confirm sheet (replaces Alert)
  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  confirmSheet: {
    width: '100%', backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, paddingBottom: 32, alignItems: 'center', gap: Spacing.sm,
  },
  confirmIconBox: { marginBottom: 4 },
  confirmTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  confirmText: { fontSize: FontSize.sm, color: Colors.textSubtle, textAlign: 'center', marginBottom: Spacing.sm },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginTop: 4 },
  confirmBtnCancel: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.lg, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnCancelText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  confirmBtnLogout: {
    flex: 1, backgroundColor: Colors.error,
    borderRadius: Radius.lg, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnLogoutText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
});
