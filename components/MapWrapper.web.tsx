// Web fallback - react-native-maps is not supported on web
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

// Stub types to match react-native-maps API
export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = 'google';

interface MapViewProps {
  style?: any;
  initialRegion?: any;
  provider?: any;
  showsMyLocationButton?: boolean;
  children?: React.ReactNode;
  ref?: any;
}

// MapView stub for web
const MapView = React.forwardRef<any, MapViewProps>(({ style, children }, _ref) => (
  <View style={[style, styles.mapFallback]}>
    <MaterialIcons name="map" size={32} color={Colors.textSubtle} />
    <Text style={styles.mapFallbackText}>Mapa disponivel apenas no app mobile</Text>
  </View>
));

MapView.displayName = 'MapView';

export default MapView;

// Marker stub
export const Marker = ({ children }: { children?: React.ReactNode; [key: string]: any }) =>
  children ? <>{children}</> : null;

// Polyline stub
export const Polyline = (_props: any) => null;

const styles = StyleSheet.create({
  mapFallback: {
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
  },
  mapFallbackText: {
    fontSize: FontSize.sm,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
});
