import { Audio } from 'expo-av';
import { Platform, Vibration } from 'react-native';

let soundObject: Audio.Sound | null = null;

/**
 * Play alert sound + vibration when a new order arrives.
 * Uses expo-av for audio and React Native Vibration for haptics.
 */
export async function playNewOrderAlert(): Promise<void> {
  // Always vibrate — it works regardless of sound file
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 500, 150, 300, 100, 500]);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  } catch (_) {}

  // Try to play sound
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    if (soundObject) {
      await soundObject.unloadAsync().catch(() => {});
      soundObject = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.freesound.org/previews/512/512136_11214653-hq.mp3' },
      { shouldPlay: true, volume: 1.0, isLooping: false }
    );
    soundObject = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        soundObject = null;
      }
    });
  } catch (error) {
    console.warn('[Sound] Alert sound unavailable:', error);
  }
}

export async function stopNewOrderAlert(): Promise<void> {
  try {
    if (soundObject) {
      await soundObject.stopAsync();
      await soundObject.unloadAsync();
      soundObject = null;
    }
    Vibration.cancel();
  } catch (_) {}
}
