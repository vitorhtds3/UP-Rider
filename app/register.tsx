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
import { supabase } from '@/services/supabase';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

type VehicleType = 'Moto' | 'Bicicleta' | 'Carro' | 'Van' | '';

const VEHICLE_OPTIONS: VehicleType[] = ['Moto', 'Bicicleta', 'Carro', 'Van'];

export default function RegisterScreen() {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [confirmarVisivel, setConfirmarVisivel] = useState(false);
  const [veiculo, setVeiculo] = useState<VehicleType>('Moto');
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 11);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  };

  const handleRegister = async () => {
    setErro('');

    if (!nome.trim()) { setErro('Nome completo e obrigatorio.'); return; }
    if (!email.trim() || !email.includes('@')) { setErro('Informe um email valido.'); return; }
    if (!telefone.trim() || telefone.replace(/\D/g, '').length < 10) { setErro('Informe um telefone valido com DDD.'); return; }
    if (senha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return; }
    if (senha !== confirmarSenha) { setErro('As senhas nao coincidem.'); return; }
    if (!veiculo) { setErro('Selecione o tipo de veiculo.'); return; }

    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = telefone.replace(/\D/g, '');

      // Store all important data in auth metadata as a reliable fallback
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: senha,
        options: {
          data: {
            name: nome.trim(),
            phone: cleanPhone,
            role: 'driver',
            vehicle: veiculo,
            status: 'pending',
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
          setErro('Este email ja esta cadastrado. Use outro email ou faca login.');
        } else {
          setErro(authError.message);
        }
        setIsLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setErro('Erro ao criar conta. Tente novamente.');
        setIsLoading(false);
        return;
      }

      // Wait briefly for any DB triggers to fire (some Supabase setups auto-create the users row)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Try UPDATE first (in case a trigger already created the row)
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: nome.trim(),
          phone: cleanPhone,
          role: 'driver',
          status: 'pending',
        })
        .eq('id', userId);

      if (updateError) {
        // Trigger did not create the row — try INSERT
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            name: nome.trim(),
            email: cleanEmail,
            phone: cleanPhone,
            role: 'driver',
            status: 'pending',
          });
        if (insertError) {
          console.warn('[Register] users table setup failed (data saved in auth metadata):', insertError.message);
        }
      }

      // Create driver profile — insert only known-good columns
      // vehicle_type is intentionally omitted (column may not exist; stored in auth metadata instead)
      const driverInsertFields: Record<string, any> = {
        user_id: userId,
        is_online: false,
      };

      const { error: driverError } = await supabase
        .from('drivers')
        .insert(driverInsertFields);

      if (driverError) {
        // Row may already exist — try upsert
        await supabase
          .from('drivers')
          .upsert({ ...driverInsertFields }, { onConflict: 'user_id' });
      }

      setSucesso(true);
    } catch (e) {
      console.error('[Register] unexpected error:', e);
      setErro('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sucesso) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }]}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg }}>
          <MaterialIcons name="check-circle" size={48} color={Colors.success} />
        </View>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm }}>Cadastro enviado!</Text>
        <Text style={{ fontSize: FontSize.sm, color: Colors.textSubtle, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl }}>
          Sua solicitacao foi recebida com sucesso. Nossa equipe ira analisar seus dados e voce sera notificado assim que aprovado.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.xl }}>
          <MaterialIcons name="schedule" size={16} color={Colors.warning} />
          <Text style={{ fontSize: FontSize.sm, color: '#92400E' }}>O processo de aprovacao leva ate 48 horas uteis.</Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 56, alignItems: 'center', justifyContent: 'center', width: '100%' }}
          onPress={() => router.replace('/login')}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff', letterSpacing: 1 }}>IR PARA O LOGIN</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.logoMini}>
              <Text style={styles.logoMiniU}>U</Text>
              <Text style={styles.logoMiniP}>P</Text>
            </View>
          </View>

          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Preencha seus dados para se cadastrar como entregador parceiro</Text>

          {/* Secao 1: Dados Pessoais */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNum}><Text style={styles.sectionNumText}>1</Text></View>
            <Text style={styles.sectionTitle}>Dados pessoais</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome completo *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome completo"
                placeholderTextColor={Colors.textSubtle}
                accessibilityLabel="Nome completo"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email *</Text>
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
                accessibilityLabel="Email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Telefone com DDD *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="phone" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={(v) => setTelefone(formatPhone(v))}
                placeholder="(11) 99999-9999"
                placeholderTextColor={Colors.textSubtle}
                keyboardType="phone-pad"
                accessibilityLabel="Telefone"
              />
            </View>
          </View>

          {/* Secao 2: Veiculo */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNum}><Text style={styles.sectionNumText}>2</Text></View>
            <Text style={styles.sectionTitle}>Tipo de veiculo</Text>
          </View>

          <View style={styles.vehicleGrid}>
            {VEHICLE_OPTIONS.map((v) => {
              const icons: Record<string, string> = {
                Moto: 'two-wheeler',
                Bicicleta: 'directions-bike',
                Carro: 'directions-car',
                Van: 'airport-shuttle',
              };
              const isSelected = veiculo === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.vehicleOption, isSelected && styles.vehicleOptionSelected]}
                  onPress={() => setVeiculo(v)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={icons[v] as any} size={20} color={isSelected ? '#fff' : Colors.textSubtle} />
                  <Text style={[styles.vehicleOptionText, isSelected && styles.vehicleOptionTextSelected]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Secao 3: Senha */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNum}><Text style={styles.sectionNumText}>3</Text></View>
            <Text style={styles.sectionTitle}>Senha de acesso</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Senha *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={senha}
                onChangeText={setSenha}
                placeholder="Minimo 6 caracteres"
                placeholderTextColor={Colors.textSubtle}
                secureTextEntry={!senhaVisivel}
                accessibilityLabel="Senha"
              />
              <TouchableOpacity onPress={() => setSenhaVisivel(!senhaVisivel)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name={senhaVisivel ? 'visibility-off' : 'visibility'} size={20} color={Colors.textSubtle} />
              </TouchableOpacity>
            </View>
            {senha.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3].map((lvl) => (
                  <View
                    key={lvl}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor: senha.length >= lvl * 4
                          ? lvl === 1 ? Colors.error : lvl === 2 ? Colors.warning : Colors.success
                          : Colors.border,
                      },
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {senha.length < 4 ? 'Fraca' : senha.length < 8 ? 'Media' : 'Forte'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmar senha *</Text>
            <View style={[
              styles.inputWrapper,
              confirmarSenha.length > 0 && {
                borderColor: confirmarSenha === senha ? Colors.success : Colors.error,
              },
            ]}>
              <MaterialIcons name="lock-outline" size={20} color={Colors.textSubtle} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                placeholder="Repita a senha"
                placeholderTextColor={Colors.textSubtle}
                secureTextEntry={!confirmarVisivel}
                accessibilityLabel="Confirmar senha"
              />
              <TouchableOpacity onPress={() => setConfirmarVisivel(!confirmarVisivel)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name={confirmarVisivel ? 'visibility-off' : 'visibility'} size={20} color={Colors.textSubtle} />
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

          {/* Botao */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>CRIAR CONTA</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold }}>Ja tenho conta. Entrar</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
  logoMini: { width: 44, height: 44, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  logoMiniU: { fontSize: 18, fontWeight: FontWeight.extrabold, color: '#fff', letterSpacing: -1 },
  logoMiniP: { fontSize: 18, fontWeight: FontWeight.extrabold, color: '#fff', letterSpacing: -1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6, marginTop: Spacing.sm },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSubtle, marginBottom: Spacing.xl, lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md, marginTop: 4 },
  sectionNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionNumText: { fontSize: 12, fontWeight: FontWeight.bold, color: '#fff' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary, marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 54 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, includeFontPadding: false },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  vehicleOption: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 14, paddingHorizontal: 12 },
  vehicleOptionSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vehicleOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  vehicleOptionTextSelected: { color: '#fff', fontWeight: FontWeight.semibold },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FontSize.xs, color: Colors.textSubtle, width: 40, textAlign: 'right' },
  erroBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.errorLight, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm, gap: 6 },
  erroText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, marginBottom: Spacing.md },
  btnPrimaryText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff', letterSpacing: 1 },
});
