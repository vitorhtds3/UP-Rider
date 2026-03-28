import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { DeliveryProvider } from '@/contexts/DeliveryContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DeliveryProvider>
          <NotificationsProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="splash" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="active-delivery" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </NotificationsProvider>
        </DeliveryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
