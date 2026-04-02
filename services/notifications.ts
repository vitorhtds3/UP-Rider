import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permissao de notificacoes negada');
      return null;
    }

    // Android requires notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pedidos', {
        name: 'Novos Pedidos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B2B',
        sound: 'default',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token to push_tokens table (upsert by token)
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
      console.error('Erro ao salvar push token:', error.message);
    } else {
      console.log('Push token salvo:', token);
    }

    return token;
  } catch (e) {
    console.error('Erro ao registrar notificacoes:', e);
    return null;
  }
}

export async function removePushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
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
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null, // Show immediately
    });
  } catch (e) {
    console.error('Erro ao exibir notificacao local:', e);
  }
}
