import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('pedidos', {
    name: 'Novos Pedidos',
    description: 'Notificacoes de novos pedidos disponiveis',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B2B',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    await ensureAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permissao negada pelo usuario');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      process.env.EXPO_PUBLIC_PROJECT_ID;

    if (!projectId || projectId === 'SEU_PROJECT_ID_AQUI') {
      console.warn('[Push] EAS projectId nao configurado — push nao funcionara em producao');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    console.log('[Push] Token obtido:', token);

    // Save/update token in push_tokens table
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          device: Platform.OS,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[Push] Erro ao salvar token:', error.message);
    } else {
      console.log('[Push] Token salvo com sucesso');
    }

    return token;
  } catch (e: any) {
    console.error('[Push] Erro ao registrar:', e?.message ?? e);
    return null;
  }
}

export async function removePushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      process.env.EXPO_PUBLIC_PROJECT_ID;

    if (!projectId || projectId === 'SEU_PROJECT_ID_AQUI') return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);
  } catch (_) {}
}

export async function showLocalNotification(
  title: string,
  body: string,
  channelId = 'pedidos'
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.error('[Push] Erro ao exibir notificacao local:', e);
  }
}
