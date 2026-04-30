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

export type ServiceRecord = {
  id: number;
  vehicle_id: number;
  service_date: string;
  mileage: number | null;
  service_type: string;
  cost: number | null;
  notes: string | null;
  created_at: string;
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

    CREATE TABLE IF NOT EXISTS service_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      service_date TEXT NOT NULL,
      mileage INTEGER,
      service_type TEXT NOT NULL,
      cost REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mileage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      mileage INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom',
      amount REAL,
      payment_day INTEGER NOT NULL,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      notification_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS permits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom',
      expiry_date TEXT NOT NULL,
      notes TEXT,
      notification_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hgv_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      check_type TEXT NOT NULL,
      interval_days INTEGER NOT NULL,
      last_done_date TEXT,
      notes TEXT,
      notification_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL,
      mileage INTEGER,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mot_history_cache (
      vehicle_id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fuel_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      fill_date TEXT NOT NULL,
      mileage INTEGER,
      litres REAL NOT NULL,
      cost REAL NOT NULL,
      full_tank INTEGER NOT NULL DEFAULT 1,
      station TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicle_notes (
      vehicle_id INTEGER PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);
}

// ── Service History ────────────────────────────────────────────────────────────

export function getServiceHistory(vehicleId: number): ServiceRecord[] {
  return db.getAllSync<ServiceRecord>(
    'SELECT * FROM service_history WHERE vehicle_id = ? ORDER BY service_date DESC',
    [vehicleId]
  );
}

export function insertServiceRecord(r: Omit<ServiceRecord, 'id' | 'created_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    `INSERT INTO service_history (vehicle_id, service_date, mileage, service_type, cost, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [r.vehicle_id, r.service_date, r.mileage ?? null, r.service_type, r.cost ?? null, r.notes ?? null, now]
  );
  return result.lastInsertRowId;
}

export function updateServiceRecord(id: number, updates: Partial<Omit<ServiceRecord, 'id' | 'vehicle_id' | 'created_at'>>) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  db.runSync(`UPDATE service_history SET ${fields} WHERE id = ?`, values);
}

export function deleteServiceRecord(id: number) {
  db.runSync('DELETE FROM service_history WHERE id = ?', [id]);
}

// ── Mileage Log ───────────────────────────────────────────────────────────────

export type MileageEntry = {
  id: number;
  vehicle_id: number;
  log_date: string;
  mileage: number;
  notes: string | null;
  created_at: string;
};

export function getMileageLog(vehicleId: number): MileageEntry[] {
  return db.getAllSync<MileageEntry>(
    'SELECT * FROM mileage_log WHERE vehicle_id = ? ORDER BY mileage DESC',
    [vehicleId]
  );
}

export function insertMileageEntry(e: Omit<MileageEntry, 'id' | 'created_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO mileage_log (vehicle_id, log_date, mileage, notes, created_at) VALUES (?, ?, ?, ?, ?)',
    [e.vehicle_id, e.log_date, e.mileage, e.notes ?? null, now]
  );
  return result.lastInsertRowId;
}

export function deleteMileageEntry(id: number) {
  db.runSync('DELETE FROM mileage_log WHERE id = ?', [id]);
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

// ── Installments ──────────────────────────────────────────────────────────────

export type InstallmentType = 'finance' | 'insurance' | 'tax' | 'custom';

export type Installment = {
  id: number;
  vehicle_id: number;
  label: string;
  type: InstallmentType;
  amount: number | null;
  payment_day: number;
  notes: string | null;
  active: number; // 1 = active, 0 = paused
  notification_id: string | null;
  created_at: string;
};

export function getInstallments(vehicleId: number): Installment[] {
  return db.getAllSync<Installment>(
    'SELECT * FROM installments WHERE vehicle_id = ? ORDER BY created_at ASC',
    [vehicleId]
  );
}

export function insertInstallment(i: Omit<Installment, 'id' | 'created_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    `INSERT INTO installments (vehicle_id, label, type, amount, payment_day, notes, active, notification_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.vehicle_id, i.label, i.type, i.amount ?? null, i.payment_day, i.notes ?? null, i.active, i.notification_id ?? null, now]
  );
  return result.lastInsertRowId;
}

export function updateInstallment(id: number, updates: Partial<Omit<Installment, 'id' | 'vehicle_id' | 'created_at'>>) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  db.runSync(`UPDATE installments SET ${fields} WHERE id = ?`, values);
}

export function deleteInstallment(id: number) {
  db.runSync('DELETE FROM installments WHERE id = ?', [id]);
}

// ── Permits ───────────────────────────────────────────────────────────────────

export type PermitType = 'dart_charge' | 'm6_toll' | 'parking' | 'ulez' | 'caz' | 'custom';

export type Permit = {
  id: number;
  vehicle_id: number;
  label: string;
  type: PermitType;
  expiry_date: string;
  notes: string | null;
  notification_id: string | null;
  created_at: string;
};

export function getPermits(vehicleId: number): Permit[] {
  return db.getAllSync<Permit>(
    'SELECT * FROM permits WHERE vehicle_id = ? ORDER BY expiry_date ASC',
    [vehicleId]
  );
}

export function insertPermit(p: Omit<Permit, 'id' | 'created_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO permits (vehicle_id, label, type, expiry_date, notes, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [p.vehicle_id, p.label, p.type, p.expiry_date, p.notes ?? null, p.notification_id ?? null, now]
  );
  return result.lastInsertRowId;
}

export function updatePermit(id: number, updates: Partial<Omit<Permit, 'id' | 'vehicle_id' | 'created_at'>>) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  db.runSync(`UPDATE permits SET ${fields} WHERE id = ?`, values);
}

export function deletePermit(id: number) {
  db.runSync('DELETE FROM permits WHERE id = ?', [id]);
}

// ── HGV Checks ────────────────────────────────────────────────────────────────

export type HgvCheck = {
  id: number;
  vehicle_id: number;
  check_type: string;
  interval_days: number;
  last_done_date: string | null;
  notes: string | null;
  notification_id: string | null;
  created_at: string;
};

export function getHgvChecks(vehicleId: number): HgvCheck[] {
  return db.getAllSync<HgvCheck>(
    'SELECT * FROM hgv_checks WHERE vehicle_id = ? ORDER BY created_at ASC',
    [vehicleId]
  );
}

export function insertHgvCheck(c: Omit<HgvCheck, 'id' | 'created_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO hgv_checks (vehicle_id, check_type, interval_days, last_done_date, notes, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [c.vehicle_id, c.check_type, c.interval_days, c.last_done_date ?? null, c.notes ?? null, c.notification_id ?? null, now]
  );
  return result.lastInsertRowId;
}

export function updateHgvCheck(id: number, updates: Partial<Omit<HgvCheck, 'id' | 'vehicle_id' | 'created_at'>>) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  db.runSync(`UPDATE hgv_checks SET ${fields} WHERE id = ?`, values);
}

export function deleteHgvCheck(id: number) {
  db.runSync('DELETE FROM hgv_checks WHERE id = ?', [id]);
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export type ChecklistItem = {
  id: number;
  vehicle_id: number;
  label: string;
  sort_order: number;
  created_at: string;
};

export type ChecklistLog = {
  id: number;
  vehicle_id: number;
  completed_at: string;
  mileage: number | null;
};

export function getChecklistItems(vehicleId: number): ChecklistItem[] {
  return db.getAllSync<ChecklistItem>(
    'SELECT * FROM checklist_items WHERE vehicle_id = ? ORDER BY sort_order ASC, created_at ASC',
    [vehicleId]
  );
}

export function insertChecklistItem(vehicleId: number, label: string, sortOrder: number): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO checklist_items (vehicle_id, label, sort_order, created_at) VALUES (?, ?, ?, ?)',
    [vehicleId, label, sortOrder, now]
  );
  return result.lastInsertRowId;
}

export function deleteChecklistItem(id: number) {
  db.runSync('DELETE FROM checklist_items WHERE id = ?', [id]);
}

export function getChecklistLogs(vehicleId: number): ChecklistLog[] {
  return db.getAllSync<ChecklistLog>(
    'SELECT * FROM checklist_logs WHERE vehicle_id = ? ORDER BY completed_at DESC LIMIT 20',
    [vehicleId]
  );
}

export function insertChecklistLog(vehicleId: number, mileage: number | null): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO checklist_logs (vehicle_id, completed_at, mileage) VALUES (?, ?, ?)',
    [vehicleId, now, mileage ?? null]
  );
  return result.lastInsertRowId;
}

// ── Cross-vehicle queries for reminders overview ──────────────────────────────

export function getAllPermitsWithVehicle(): (Permit & { registration_number: string; make: string })[] {
  return db.getAllSync(
    `SELECT p.*, v.registration_number, v.make FROM permits p
     JOIN vehicles v ON p.vehicle_id = v.id
     ORDER BY p.expiry_date ASC`
  );
}

export function getAllHgvChecksWithVehicle(): (HgvCheck & { registration_number: string; make: string })[] {
  return db.getAllSync(
    `SELECT h.*, v.registration_number, v.make FROM hgv_checks h
     JOIN vehicles v ON h.vehicle_id = v.id`
  );
}

export function getAllInstallmentsWithVehicle(): (Installment & { registration_number: string; make: string })[] {
  return db.getAllSync(
    `SELECT i.*, v.registration_number, v.make FROM installments i
     JOIN vehicles v ON i.vehicle_id = v.id
     WHERE i.active = 1`
  );
}

// ── Fuel Log ──────────────────────────────────────────────────────────────────

export type FuelEntry = {
  id: number;
  vehicle_id: number;
  fill_date: string;
  mileage: number | null;
  litres: number;
  cost: number;
  full_tank: number; // 1 = full, 0 = partial
  station: string | null;
  notes: string | null;
  created_at: string;
};

export function getFuelLog(vehicleId: number): FuelEntry[] {
  return db.getAllSync<FuelEntry>(
    'SELECT * FROM fuel_log WHERE vehicle_id = ? ORDER BY fill_date DESC, created_at DESC',
    [vehicleId]
  );
}

export function insertFuelEntry(e: Omit<FuelEntry, 'id' | 'created_at'>): number {
  const now = new Date().toISOString();
  const result = db.runSync(
    `INSERT INTO fuel_log (vehicle_id, fill_date, mileage, litres, cost, full_tank, station, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.vehicle_id, e.fill_date, e.mileage ?? null, e.litres, e.cost, e.full_tank, e.station ?? null, e.notes ?? null, now]
  );
  return result.lastInsertRowId;
}

export function deleteFuelEntry(id: number) {
  db.runSync('DELETE FROM fuel_log WHERE id = ?', [id]);
}

// ── Vehicle Notes ─────────────────────────────────────────────────────────────

export function getVehicleNotes(vehicleId: number): string {
  const row = db.getFirstSync<{ content: string }>(
    'SELECT content FROM vehicle_notes WHERE vehicle_id = ?',
    [vehicleId]
  );
  return row?.content ?? '';
}

export function saveVehicleNotes(vehicleId: number, content: string) {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO vehicle_notes (vehicle_id, content, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(vehicle_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    [vehicleId, content, now]
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

export function getServiceHistoryForExport(vehicleId: number): ServiceRecord[] {
  return getServiceHistory(vehicleId);
}

export function getMileageLogForExport(vehicleId: number): MileageEntry[] {
  return getMileageLog(vehicleId);
}

export function getFuelLogForExport(vehicleId: number): FuelEntry[] {
  return getFuelLog(vehicleId);
}

// ── MOT History Cache ─────────────────────────────────────────────────────────

export type MotHistoryCacheRow = {
  vehicle_id: number;
  data: string; // JSON string
  fetched_at: string; // ISO timestamp
};

export function getMotHistoryCache(vehicleId: number): MotHistoryCacheRow | null {
  return db.getFirstSync<MotHistoryCacheRow>(
    'SELECT * FROM mot_history_cache WHERE vehicle_id = ?',
    [vehicleId]
  ) ?? null;
}

export function saveMotHistoryCache(vehicleId: number, data: string) {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO mot_history_cache (vehicle_id, data, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(vehicle_id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
    [vehicleId, data, now]
  );
}

export function clearMotHistoryCache(vehicleId: number) {
  db.runSync('DELETE FROM mot_history_cache WHERE vehicle_id = ?', [vehicleId]);
}
