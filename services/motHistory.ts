import * as SecureStore from 'expo-secure-store';
import { Keys } from './storage';

// ── OAuth2 config ─────────────────────────────────────────────────────────────

const TENANT_ID = 'a455b827-244f-4c97-b5b4-ce5d13b4d00c';
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const SCOPE = 'https://tapi.dvsa.gov.uk/.default';
const MOT_HISTORY_BASE = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';

// ── In-memory token cache ─────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0; // Unix ms

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = await SecureStore.getItemAsync(Keys.DVSA_CLIENT_ID);
  const clientSecret = await SecureStore.getItemAsync(Keys.DVSA_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error('DVSA credentials not found. Please reinstall the app.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPE,
  }).toString();

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`DVSA auth failed: ${(err as any)?.error_description ?? res.status}`);
  }

  const json = await res.json();
  cachedToken = json.access_token as string;
  tokenExpiresAt = Date.now() + (json.expires_in as number) * 1000;

  return cachedToken;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MotDefect = {
  type: 'ADVISORY' | 'MINOR' | 'MAJOR' | 'DANGEROUS' | 'USER_ENTERED';
  text: string;
  dangerous: boolean;
};

export type MotTest = {
  completedDate: string;
  testResult: 'PASSED' | 'FAILED';
  expiryDate: string | null;
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

// ── Main fetch function ───────────────────────────────────────────────────────

export async function fetchMotHistory(registration: string): Promise<MotHistoryVehicle> {
  const [accessToken, apiKey] = await Promise.all([
    getAccessToken(),
    SecureStore.getItemAsync(Keys.DVSA_API_KEY),
  ]);

  if (!apiKey) throw new Error('DVSA API key not found. Please reinstall the app.');

  const reg = registration.replace(/\s+/g, '').toUpperCase();

  const res = await fetch(`${MOT_HISTORY_BASE}/${reg}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
    },
  });

  if (res.status === 404) throw new Error('No MOT history found for this vehicle.');
  if (res.status === 401) {
    // Token may have been revoked — clear cache and let user retry
    cachedToken = null;
    tokenExpiresAt = 0;
    throw new Error('MOT History authentication failed. Please try again.');
  }
  if (res.status === 403) throw new Error('MOT History API access denied.');

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `MOT History API error (${res.status})`);
  }

  const data = await res.json();
  return data as MotHistoryVehicle;
}
