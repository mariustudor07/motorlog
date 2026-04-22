import AsyncStorage from '@react-native-async-storage/async-storage';

export type Thresholds = {
  amberDays: number; // show amber below this many days  (default 90)
  redDays: number;   // show red below this many days    (default 30)
};

const DEFAULTS: Thresholds = {
  amberDays: 90,
  redDays: 30,
};

const STORAGE_KEY = 'reminder_thresholds';

// Module-level cache so StatusBadge can read synchronously after first load
let _cache: Thresholds = { ...DEFAULTS };

export async function loadThresholds(): Promise<Thresholds> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) _cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return _cache;
}

/** Synchronous — returns cached value (always up to date after loadThresholds() called) */
export function getThresholds(): Thresholds {
  return _cache;
}

export async function saveThresholds(t: Thresholds): Promise<void> {
  _cache = { ...t };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export function getDefaults(): Thresholds {
  return { ...DEFAULTS };
}
