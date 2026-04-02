import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight } from '@/constants/theme';

export default function SplashScreen() {
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;
  const bgScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
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
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(bgScale, {
          toValue: 1.15,
          duration: 350,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      router.replace('/login');
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: bgScale }] }]}>
      <Animated.View style={[styles.logoWrapper, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.logoBox}>
          <Text style={styles.logoU}>U</Text>
          <View style={styles.logoP}>
            <Text style={styles.logoPText}>P</Text>
            <View style={styles.logoDot} />
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslateY }], alignItems: 'center', marginTop: 24 }}>
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
