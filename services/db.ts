import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('motorlog.db');

export type Vehicle = {
  id: number;
  registration_number: string;
  make: string;
  colour: string;
  fuel_type: string;
  engine_capacity: number | null;
  year_of_manufacture: number | null;
  co2_emissions: number | null;
  euro_status: string | null;
  mot_status: string | null;
  mot_expiry_date: string | null;
  tax_status: string | null;
  tax_due_date: string | null;
  insurance_expiry_date: string | null;
  raw_dvla_json: string | null;
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: number;
  vehicle_id: number;
  type: 'mot' | 'tax' | 'insurance';
  due_date: string;
  notification_id: string | null;
  days_before: number;
};

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      colour TEXT,
      fuel_type TEXT,
      engine_capacity INTEGER,
      year_of_manufacture INTEGER,
      co2_emissions INTEGER,
      euro_status TEXT,
      mot_status TEXT,
      mot_expiry_date TEXT,
      tax_status TEXT,
      tax_due_date TEXT,
      insurance_expiry_date TEXT,
      raw_dvla_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      due_date TEXT NOT NULL,
      notification_id TEXT,
      days_before INTEGER NOT NULL DEFAULT 30,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);
}

export function getAllVehicles(): Vehicle[] {
  return db.getAllSync<Vehicle>('SELECT * FROM vehicles ORDER BY updated_at DESC');
}

export function getVehicleById(id: number): Vehicle | null {
  return db.getFirstSync<Vehicle>('SELECT * FROM vehicles WHERE id = ?', [id]);
}

export function insertVehicle(v: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    `INSERT INTO vehicles (registration_number, make, colour, fuel_type, engine_capacity,
      year_of_manufacture, co2_emissions, euro_status, mot_status, mot_expiry_date,
      tax_status, tax_due_date, insurance_expiry_date, raw_dvla_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      v.registration_number, v.make, v.colour, v.fuel_type, v.engine_capacity,
      v.year_of_manufacture, v.co2_emissions, v.euro_status, v.mot_status, v.mot_expiry_date,
      v.tax_status, v.tax_due_date, v.insurance_expiry_date, v.raw_dvla_json, now, now,
    ]
  );
  return result.lastInsertRowId;
}

export function updateVehicle(id: number, updates: Partial<Omit<Vehicle, 'id' | 'created_at'>>) {
  const now = new Date().toISOString();
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), now, id];
  db.runSync(`UPDATE vehicles SET ${fields}, updated_at = ? WHERE id = ?`, values);
}

export function deleteVehicle(id: number) {
  db.runSync('DELETE FROM vehicles WHERE id = ?', [id]);
}

export function getRemindersForVehicle(vehicleId: number): Reminder[] {
  return db.getAllSync<Reminder>('SELECT * FROM reminders WHERE vehicle_id = ?', [vehicleId]);
}

export function getAllReminders(): (Reminder & { registration_number: string; make: string })[] {
  return db.getAllSync(
    `SELECT r.*, v.registration_number, v.make FROM reminders r
     JOIN vehicles v ON r.vehicle_id = v.id
     ORDER BY r.due_date ASC`
  );
}

export function upsertReminder(r: Omit<Reminder, 'id'>): number {
  const existing = db.getFirstSync<Reminder>(
    'SELECT * FROM reminders WHERE vehicle_id = ? AND type = ? AND days_before = ?',
    [r.vehicle_id, r.type, r.days_before]
  );
  if (existing) {
    db.runSync(
      'UPDATE reminders SET due_date = ?, notification_id = ? WHERE id = ?',
      [r.due_date, r.notification_id, existing.id]
    );
    return existing.id;
  }
  const result = db.runSync(
    'INSERT INTO reminders (vehicle_id, type, due_date, notification_id, days_before) VALUES (?, ?, ?, ?, ?)',
    [r.vehicle_id, r.type, r.due_date, r.notification_id, r.days_before]
  );
  return result.lastInsertRowId;
}

export function deleteRemindersForVehicle(vehicleId: number) {
  db.runSync('DELETE FROM reminders WHERE vehicle_id = ?', [vehicleId]);
}
