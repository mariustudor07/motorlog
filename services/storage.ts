import * as SecureStore from 'expo-secure-store';

export const Keys = {
  DVLA_API_KEY: 'dvla_api_key',
  GEMINI_API_KEY: 'gemini_api_key',
};

export async function getApiKey(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setApiKey(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value.trim());
}

export async function clearApiKey(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key);
}
