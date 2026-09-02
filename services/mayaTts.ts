import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';

let activeSound: Audio.Sound | null = null;
let activeTempUri: string | null = null;
let isSpeakingState = false;

/**
 * Checks if Maya is currently playing TTS audio.
 */
export const isMayaSpeaking = (): boolean => isSpeakingState;

/**
 * Stops and unloads any ongoing Maya TTS playback immediately.
 */
export const stopMayaTTS = async (): Promise<void> => {
  if (activeSound) {
    try {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
    } catch (e) {
      // Ignore unload errors
    } finally {
      activeSound = null;
    }
  }

  if (activeTempUri) {
    try {
      await FileSystem.deleteAsync(activeTempUri, { idempotent: true });
    } catch (e) {
      // Ignore deletion errors
    } finally {
      activeTempUri = null;
    }
  }

  isSpeakingState = false;
};

/**
 * Plays Maya's voice response using expo-av from /ai/tts base64 audio.
 * Automatically stops any existing audio, cleans up temporary files,
 * and notifies playback lifecycle hooks (for mic-gating).
 */
export const playMayaTTS = async (
  text: string,
  isTtsEnabled: boolean,
  onPlaybackStart?: () => void,
  onPlaybackEnd?: () => void
): Promise<void> => {
  if (!isTtsEnabled || !text || !text.trim()) {
    return;
  }

  // 1. Stop any currently playing sound
  await stopMayaTTS();

  try {
    // 2. Fetch TTS audio base64 from backend
    const res = await api.post('/ai/tts', { text: text.trim() }, { timeout: 15000 });
    const audio_b64 = res.data?.audio_b64;
    if (!audio_b64) return;

    // 3. Write base64 audio data to temp WAV cache file
    const cacheDir = (FileSystem as any).cacheDirectory || FileSystem.cacheDirectory || '';
    const tempUri = `${cacheDir}maya_tts_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(tempUri, audio_b64, {
      encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
    });
    activeTempUri = tempUri;

    // 4. Configure audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    isSpeakingState = true;
    onPlaybackStart?.();

    // 5. Create sound instance and start playback
    const { sound } = await Audio.Sound.createAsync(
      { uri: tempUri },
      { shouldPlay: true, volume: 1.0 }
    );
    activeSound = sound;

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        await stopMayaTTS();
        onPlaybackEnd?.();
      }
    });
  } catch (err: any) {
    console.warn('[Maya-TTS] Playback failed (caught gracefully):', err.message || err);
    await stopMayaTTS();
    onPlaybackEnd?.();
  }
};
