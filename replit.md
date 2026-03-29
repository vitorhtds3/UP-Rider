# UP Rider - Delivery Partner App

## Project Overview

UP Rider (internally `onspace-app`) is a cross-platform mobile application for delivery partners, built with React Native and Expo. It provides an interface for drivers to manage orders, track earnings, and receive real-time notifications.

## Tech Stack

- **Framework**: Expo SDK 53 + React Native 0.79
- **Navigation**: Expo Router (file-based routing)
- **Backend/Auth**: Supabase
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Styling**: NativeWind (Tailwind for React Native) + react-native-paper
- **State**: Zustand + React Context API
- **Maps**: react-native-maps

## Project Structure

```
app/               # Expo Router pages
  (tabs)/          # Tab-based navigation (home, orders, earnings, notifications, profile)
  login.tsx        # Authentication screen
  register.tsx     # Registration screen
  splash.tsx       # Splash screen
  active-delivery.tsx  # Active delivery tracking
components/        # Reusable UI components
contexts/          # React Context providers (Auth, Delivery, Notifications)
hooks/             # Custom hooks
services/          # External service integrations (supabase, notifications, sound)
constants/         # Theme definitions (Colors, spacing, typography)
assets/            # Fonts and images
```

## Environment Variables

Stored in `.env` (included in repo):
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Development

The app runs on port 5000 in web mode:

```bash
PORT=5000 npx expo start --web --localhost --port 5000
```

The workflow "Start application" is configured to run this command automatically.

## Deployment

Configured as a static deployment:
- **Build**: `npx expo export --platform web`
- **Output**: `dist/` directory

## Architecture Notes

- **No `users` table** — all user info lives in Supabase `auth.user_metadata` (name, phone, role, vehicle, status). Never read/write a `users` table.
- **Supabase tables used**: `drivers` (user_id, status, is_online, latitude, longitude, last_update), `orders` (id, restaurant_id, client_id, driver_id, status, total, delivery_fee, delivery_address, created_at, + optional coord columns), `push_tokens`, `restaurants`, `notifications`.
- **No `Alert.alert`** — replaced with custom in-screen confirm sheets on every screen (blocked in iframes/web).
- **Location tracking**: uses `expo-location` on native, `navigator.geolocation.watchPosition` on web. Tracks when driver is online; pauses when offline.
- **Realtime**: `orders` and `notifications` tables use Supabase realtime subscriptions + polling fallback.

## Bug Fixes Applied (March 2026)

1. **Splash screen auth check** — now checks Supabase session and routes to `/` (authenticated) or `/login` (unauthenticated) after exactly ~4 seconds of animation
2. **Index routing** — properly handles: loading state, pending-account screen, authenticated redirect, unauthenticated redirect
3. **Login "Esqueci senha"** — implemented forgot-password modal with Supabase `resetPasswordForEmail()`, success confirmation state, and proper redirect to `/` on login so pending-account check in index.tsx runs correctly
4. **Register vehicle_type** — fixed: `vehicle_type: veiculo` is now saved to the `drivers` table on registration
5. **Profile account status** — replaced hardcoded "Conta verificada" with `AccountStatusRow` component that reads real `entregador.accountStatus` and shows appropriate color/label for `active`, `pending`, `suspended`, `rejected` states
6. **Web tab bar height** — updated from 70px to 84px (50px tab bar + 34px safe-area bottom inset) per Expo guidelines
7. **expo-notifications projectId** — `getExpoPushTokenAsync()` now reads `projectId` from `Constants.expoConfig.extra.eas.projectId` to avoid token-registration failures in production builds
8. **expo-av migration** — `soundService.ts` migrated from deprecated `expo-av` to `expo-audio` (`AudioPlayer`), eliminating SDK 54 deprecation warning
