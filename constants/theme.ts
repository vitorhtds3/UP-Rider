// UP Rider - Design Tokens
export const Colors = {
  primary: '#FF6B2B',
  primaryDark: '#E8501A',
  primaryLight: '#FF8C5A',
  primaryUltraLight: '#FFF0EB',

  background: '#F7F4F1',
  surface: '#FFFFFF',
  surfaceSecondary: '#F2EDE9',

  textPrimary: '#1A1010',
  textSecondary: '#5A4A42',
  textSubtle: '#9C8880',
  textInverse: '#FFFFFF',

  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  online: '#22C55E',
  offline: '#9CA3AF',

  border: '#EDE8E3',
  borderLight: '#F5F0EC',
  shadow: 'rgba(90, 40, 20, 0.10)',

  tabBar: '#FFFFFF',
  tabBarBorder: '#F0EAE5',
  tabActive: '#FF6B2B',
  tabInactive: '#B0A09A',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
