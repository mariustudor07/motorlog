import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { initDatabase } from '../services/db';
import { requestNotificationPermissions } from '../services/notifications';
import { loadThresholds } from '../services/thresholds';
import { getApiKey, setApiKey, Keys } from '../services/storage';
import { Colors } from '../constants/colors';

/** Seed default API keys from .env on first launch — won't overwrite if user has already saved their own */
async function seedDefaultKeys() {
  const { dvlaApiKey, geminiApiKey } = Constants.expoConfig?.extra ?? {};

  if (dvlaApiKey) {
    const existing = await getApiKey(Keys.DVLA_API_KEY);
    if (!existing) await setApiKey(Keys.DVLA_API_KEY, dvlaApiKey);
  }

  if (geminiApiKey) {
    const existing = await getApiKey(Keys.GEMINI_API_KEY);
    if (!existing) await setApiKey(Keys.GEMINI_API_KEY, geminiApiKey);
  }
}

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
    loadThresholds();
    requestNotificationPermissions();
    seedDefaultKeys();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
