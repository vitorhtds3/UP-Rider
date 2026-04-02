import { Tabs, Redirect } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useDelivery } from '@/hooks/useDelivery';
import { useNotifications } from '@/hooks/useNotifications';
import { Colors } from '@/constants/theme';

function OrdersTabIcon({ color, size }: { color: string; size: number }) {
  const { pedidosDisponiveis } = useDelivery();
  const count = pedidosDisponiveis.length;
  return (
    <View>
      <MaterialIcons name="receipt-long" size={size} color={color} />
      {count > 0 && (
        <View style={[styles.badge, styles.badgeOrange]}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </View>
  );
}

function NotificationsTabIcon({ color, size }: { color: string; size: number }) {
  const { unreadCount } = useNotifications();
  return (
    <View>
      <MaterialIcons name="notifications" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={[styles.badge, styles.badgeRed]}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeOrange: { backgroundColor: Colors.primary },
  badgeRed: { backgroundColor: Colors.error },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 64,
      android: insets.bottom + 64,
      default: 72,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 16,
    backgroundColor: '#0F1923',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#00C896',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.40)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => (
            <OrdersTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Ganhos',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="account-balance-wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificacoes',
          tabBarIcon: ({ color, size }) => (
            <NotificationsTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
