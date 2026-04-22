import * as SecureStore from 'expo-secure-store';
import { Keys } from './storage';

const MOT_HISTORY_BASE = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';

export type MotDefect = {
  type: 'ADVISORY' | 'MINOR' | 'MAJOR' | 'DANGEROUS' | 'USER_ENTERED';
  text: string;
  dangerous: boolean;
};

export type MotTest = {
  completedDate: string;       // e.g. "2024-03-15"
  testResult: 'PASSED' | 'FAILED';
  expiryDate: string | null;   // null on failure
  odometerValue: string | null;
  odometerUnit: 'mi' | 'km' | null;
  motTestNumber: string;
  defects: MotDefect[];
};

export type MotHistoryVehicle = {
  registration: string;
  make: string;
  model: string;
  firstUsedDate: string;
  fuelType: string;
  primaryColour: string;
  motTests: MotTest[];
};

export async function fetchMotHistory(registration: string): Promise<MotHistoryVehicle> {
  const apiKey = await SecureStore.getItemAsync(Keys.MOT_HISTORY_API_KEY);
  if (!apiKey) throw new Error('MOT History API key not set. Go to Settings to add it.');

  const reg = registration.replace(/\s+/g, '').toUpperCase();
  const res = await fetch(`${MOT_HISTORY_BASE}/${reg}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (res.status === 404) throw new Error('No MOT history found for this vehicle.');
  if (res.status === 403) throw new Error('Invalid MOT History API key. Check Settings.');

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `MOT History API error (${res.status})`);
  }

  const data = await res.json();
  return data as MotHistoryVehicle;
}
