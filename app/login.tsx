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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async () => {
    setErro('');
    if (!email.trim() || !senha.trim()) {
      setErro('Preencha todos os campos.');
      return;
    }
    const result = await login(email, senha);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setErro(result.error || 'Erro ao entrar.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
                <TouchableOpacity onPress={() => setSenhaVisivel(!senhaVisivel)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name={senhaVisivel ? 'visibility-off' : 'visibility'} size={20} color={Colors.textSubtle} />
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
            <TouchableOpacity style={styles.forgotBtn} onPress={() => {}}>
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
});
