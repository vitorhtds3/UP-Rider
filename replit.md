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
