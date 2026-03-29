import { Platform, Vibration } from 'react-native';

let currentPlayer: any = null;

/**
 * Play alert sound + vibration when a new order arrives.
 * Uses expo-audio for audio and React Native Vibration for haptics.
 * Falls back gracefully on web (no vibration/audio APIs).
 */
export async function playNewOrderAlert(): Promise<void> {
  // Vibrate on native only
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 500, 150, 300, 100, 500]);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  } catch (_) {}

  // Audio only on native
  if (Platform.OS === 'web') return;

  try {
    // Dynamically import to avoid module-level side effects
    const { AudioPlayer } = await import('expo-audio');

    if (currentPlayer) {
      try { currentPlayer.remove(); } catch (_) {}
      currentPlayer = null;
    }

    const player = new AudioPlayer(
      { uri: 'https://cdn.freesound.org/previews/512/512136_11214653-hq.mp3' }
    );
    currentPlayer = player;
    player.volume = 1.0;
    player.loop = false;
    player.play();

    // Auto-cleanup after 30 seconds (safety net)
    setTimeout(() => {
      if (currentPlayer === player) {
        try { player.remove(); } catch (_) {}
        currentPlayer = null;
      }
    }, 30_000);
  } catch (error) {
    console.warn('[Sound] Alert sound unavailable:', error);
  }
}

export async function stopNewOrderAlert(): Promise<void> {
  try {
    if (currentPlayer) {
      currentPlayer.pause();
      try { currentPlayer.remove(); } catch (_) {}
      currentPlayer = null;
    }
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
  } catch (_) {}
}
