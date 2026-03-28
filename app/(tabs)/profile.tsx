import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
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

  const handleSalvar = () => {
    updateEntregador({ nome: editNome, telefone: editTelefone, veiculo: editVeiculo });
    setEditModal(false);
    Alert.alert('Perfil atualizado!', 'Suas informacoes foram salvas com sucesso.');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        },
      ]
    );
  };

  const iniciais = entregador?.nome?.split(' ').slice(0, 2).map(n => n[0]).join('') || 'E';

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: Spacing.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success }} />
            <View>
              <Text style={styles.infoValue}>Conta verificada</Text>
              <Text style={styles.infoLabel}>Ativa e aprovada</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
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
                <Text style={styles.salvarBtnText}>Salvar alteracoes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.xxl },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
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
  salvarBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  salvarBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
});
