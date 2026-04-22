import * as SecureStore from 'expo-secure-store';

export type DvlaVehicle = {
  registrationNumber: string;
  make: string;
  colour: string;
  fuelType: string;
  engineCapacity?: number;
  yearOfManufacture?: number;
  co2Emissions?: number;
  euroStatus?: string;
  motStatus?: string;
  taxStatus?: string;
  taxDueDate?: string;
  monthOfFirstRegistration?: string;
  typeApproval?: string;
  wheelplan?: string;
  markedForExport?: boolean;
  dateOfLastV5CIssued?: string;
  revenueWeight?: number;
  realDrivingEmissions?: string;
  artEndDate?: string;
};

const DVLA_ENDPOINT = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

export async function lookupVehicle(registration: string): Promise<DvlaVehicle> {
  const apiKey = await SecureStore.getItemAsync('dvla_api_key');
  if (!apiKey) throw new Error('DVLA API key not set. Go to Settings to add it.');

  const cleaned = registration.replace(/\s+/g, '').toUpperCase();

  const res = await fetch(DVLA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ registrationNumber: cleaned }),
  });

  if (res.status === 404) throw new Error('Vehicle not found. Check the registration plate.');
  if (res.status === 400) throw new Error('Invalid registration number format.');
  if (!res.ok) throw new Error(`DVLA API error (${res.status}). Please try again.`);

  return res.json();
}
