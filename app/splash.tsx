import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight } from '@/constants/theme';

export default function SplashScreen() {
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;

    // Run auth check and animation in parallel
    // Animation takes exactly ~4000ms total
    const animationPromise = new Promise<void>((resolve) => {
      Animated.sequence([
        // Logo appears (0–700ms)
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 60,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        // Text appears (700–1050ms)
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Hold (1050–3600ms)
        Animated.delay(2550),
        // Fade everything out (3600–4000ms)
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

    const authPromise = supabase.auth.getSession().then(({ data: { session } }) => {
      return !!session;
    }).catch(() => false);

    Promise.all([animationPromise, authPromise]).then(([, isLoggedIn]) => {
      if (!isMounted) return;
      if (isLoggedIn) {
        router.replace('/');
      } else {
        router.replace('/login');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoU}>U</Text>
          <View style={styles.logoP}>
            <Text style={styles.logoPText}>P</Text>
            <View style={styles.logoDot} />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslateY }],
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <Text style={styles.appName}>UP Rider</Text>
        <Text style={styles.tagline}>O app dos entregadores parceiros</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
    paddingHorizontal: 8,
  },
  logoU: {
    fontSize: 48,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: -2,
  },
  logoP: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logoPText: {
    fontSize: 48,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: -2,
    lineHeight: 52,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: -4,
    marginRight: 2,
  },
  appName: {
    fontSize: 32,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    letterSpacing: 0.2,
  },
});
