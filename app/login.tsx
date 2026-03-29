import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, setErro] = useState('');

  // Forgot password state
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    setErro('');
    if (!email.trim() || !senha.trim()) {
      setErro('Preencha todos os campos.');
      return;
    }
    const result = await login(email.trim().toLowerCase(), senha);
    if (result.success) {
      router.replace('/');
    } else {
      setErro(result.error || 'Erro ao entrar.');
    }
  };

  const handleForgotPassword = async () => {
    const emailToReset = forgotEmail.trim().toLowerCase();
    if (!emailToReset || !emailToReset.includes('@')) {
      Alert.alert('Email invalido', 'Informe um endereco de email valido.');
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToReset);
      if (error) {
        Alert.alert('Erro', 'Nao foi possivel enviar o email. Verifique o endereco e tente novamente.');
      } else {
        setForgotSent(true);
      }
    } catch {
      Alert.alert('Erro', 'Erro inesperado. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setForgotModal(false);
    setForgotEmail('');
    setForgotSent(false);
    setForgotLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Orange Header with Logo */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoU}>U</Text>
              <View style={styles.logoPWrapper}>
                <Text style={styles.logoP}>P</Text>
                <View style={styles.logoDot} />
              </View>
            </View>
            <Text style={styles.appName}>UP Rider</Text>
            <Text style={styles.appTagline}>O app dos entregadores parceiros</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar na conta</Text>
            <Text style={styles.cardSubtitle}>Acesse para comecar suas entregas</Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.textSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  accessibilityLabel="Email"
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Sua senha"
                  placeholderTextColor={Colors.textSubtle}
                  secureTextEntry={!senhaVisivel}
                  accessibilityLabel="Senha"
                />
                <TouchableOpacity
                  onPress={() => setSenhaVisivel(!senhaVisivel)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={senhaVisivel ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={Colors.textSubtle}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Erro */}
            {erro !== '' && (
              <View style={styles.erroBox}>
                <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                <Text style={styles.erroText}>{erro}</Text>
              </View>
            )}

            {/* Esqueci senha */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => {
                setForgotEmail(email.trim());
                setForgotModal(true);
              }}
            >
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </TouchableOpacity>

            {/* Botao Entrar */}
            <TouchableOpacity
              style={[styles.btnEntrar, isLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnEntrarText}>ENTRAR</Text>
              )}
            </TouchableOpacity>

            {/* Criar conta */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Nao tem conta? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.registerLink}>Criar conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModal}
        transparent
        animationType="slide"
        onRequestClose={closeForgotModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            {forgotSent ? (
              /* Success state */
              <View style={styles.forgotSuccess}>
                <View style={styles.forgotSuccessIcon}>
                  <MaterialIcons name="mark-email-read" size={36} color={Colors.success} />
                </View>
                <Text style={styles.forgotSuccessTitle}>Email enviado!</Text>
                <Text style={styles.forgotSuccessText}>
                  Verifique sua caixa de entrada e siga as instrucoes para redefinir sua senha.
                </Text>
                <TouchableOpacity style={styles.forgotDoneBtn} onPress={closeForgotModal} activeOpacity={0.85}>
                  <Text style={styles.forgotDoneBtnText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Form state */
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Recuperar senha</Text>
                  <TouchableOpacity onPress={closeForgotModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.forgotDesc}>
                  Informe seu email cadastrado. Enviaremos um link para redefinir sua senha.
                </Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="email" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    accessibilityLabel="Email para recuperacao"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.btnEntrar, { marginTop: Spacing.lg }, forgotLoading && styles.btnDisabled]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnEntrarText}>ENVIAR LINK</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
    paddingHorizontal: 6,
  },
  logoU: {
    fontSize: 40,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: -2,
  },
  logoPWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoP: {
    fontSize: 40,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: -2,
    lineHeight: 44,
  },
  logoDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.primary,
    marginTop: -4,
    marginRight: 2,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginBottom: 4,
  },
  appTagline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    minHeight: 480,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  eyeBtn: {
    padding: 4,
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  erroText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    flex: 1,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    marginTop: 4,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  btnEntrar: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: Spacing.lg,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnEntrarText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 1,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
  },
  registerLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  forgotDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  forgotSuccess: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  forgotSuccessIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  forgotSuccessTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  forgotSuccessText: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  forgotDoneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  forgotDoneBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
