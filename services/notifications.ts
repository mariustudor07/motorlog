import * as Notifications from 'expo-notifications';
import { upsertReminder, deleteRemindersForVehicle, getRemindersForVehicle, updateInstallment, Installment, updatePermit, Permit, updateHgvCheck, HgvCheck } from './db';
import { getThresholds } from './thresholds';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

type ReminderTarget = {
  vehicleId: number;
  registration: string;
  make: string;
  type: 'mot' | 'tax' | 'insurance';
  dueDate: string;
};

/** Returns the days-before list derived from user thresholds: amber, red, and 1 day before */
function getReminderDays(): number[] {
  const { amberDays, redDays } = getThresholds();
  // Deduplicate and sort descending so we schedule furthest-out first
  return [...new Set([amberDays, redDays, 1])].sort((a, b) => b - a);
}

const LABELS: Record<string, string> = {
  mot: 'MOT',
  tax: 'Road Tax',
  insurance: 'Insurance',
};

export async function scheduleRemindersForVehicle(target: ReminderTarget) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  const dueDate = new Date(target.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const daysBefore of getReminderDays()) {
    const triggerDate = new Date(dueDate);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0);

    if (triggerDate <= today) continue;

    const { amberDays, redDays } = getThresholds();
    const urgency = daysBefore <= redDays ? '🔴' : daysBefore <= amberDays ? '🟡' : '🟢';

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${urgency} ${LABELS[target.type]} Due Soon`,
        body: `${target.registration} (${target.make}) — ${LABELS[target.type]} expires in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`,
        data: { vehicleId: target.vehicleId, type: target.type },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    upsertReminder({
      vehicle_id: target.vehicleId,
      type: target.type,
      due_date: target.dueDate,
      notification_id: notifId,
      days_before: daysBefore,
    });
  }
}

export async function cancelRemindersForVehicle(vehicleId: number) {
  const reminders = getRemindersForVehicle(vehicleId);
  for (const r of reminders) {
    if (r.notification_id) {
      await Notifications.cancelScheduledNotificationAsync(r.notification_id);
    }
  }
  deleteRemindersForVehicle(vehicleId);
}

// ── Installment reminders ─────────────────────────────────────────────────────

/** Returns the next date a payment falls on (clamps to last day if month is short) */
export function getNextPaymentDate(paymentDay: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const clampedDate = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(paymentDay, lastDay));
  };

  const thisMonth = clampedDate(today.getFullYear(), today.getMonth());
  if (thisMonth >= today) return thisMonth;

  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return clampedDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
}

export async function scheduleInstallmentReminder(installment: Installment, registration: string, make: string): Promise<string | null> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  // Cancel existing notification if any
  if (installment.notification_id) {
    await Notifications.cancelScheduledNotificationAsync(installment.notification_id).catch(() => {});
  }

  const paymentDate = getNextPaymentDate(installment.payment_day);
  const triggerDate = new Date(paymentDate);
  triggerDate.setDate(triggerDate.getDate() - 1); // 1 day before
  triggerDate.setHours(9, 0, 0, 0);

  const now = new Date();
  if (triggerDate <= now) {
    // Payment is today or past — schedule for next month
    const nextMonthDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, paymentDate.getDate());
    nextMonthDate.setDate(nextMonthDate.getDate() - 1);
    nextMonthDate.setHours(9, 0, 0, 0);
    if (nextMonthDate <= now) return null;
    triggerDate.setTime(nextMonthDate.getTime());
  }

  const amountStr = installment.amount != null ? ` (£${installment.amount.toFixed(2)})` : '';
  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `💳 Payment Due Tomorrow`,
      body: `${installment.label}${amountStr} — ${registration} (${make})`,
      data: { vehicleId: installment.vehicle_id, installmentId: installment.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notifId;
}

export async function cancelInstallmentReminder(notificationId: string | null) {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
  }
}

export async function rescheduleAll(vehicles: {
  id: number;
  registration_number: string;
  make: string;
  mot_expiry_date: string | null;
  tax_due_date: string | null;
  insurance_expiry_date: string | null;
}[]) {
  for (const v of vehicles) {
    await cancelRemindersForVehicle(v.id);
    const targets: ReminderTarget[] = [];

    if (v.mot_expiry_date)
      targets.push({ vehicleId: v.id, registration: v.registration_number, make: v.make, type: 'mot', dueDate: v.mot_expiry_date });
    if (v.tax_due_date)
      targets.push({ vehicleId: v.id, registration: v.registration_number, make: v.make, type: 'tax', dueDate: v.tax_due_date });
    if (v.insurance_expiry_date)
      targets.push({ vehicleId: v.id, registration: v.registration_number, make: v.make, type: 'insurance', dueDate: v.insurance_expiry_date });

    for (const t of targets) await scheduleRemindersForVehicle(t);
  }
}

// ── Permit reminders ──────────────────────────────────────────────────────────

export async function schedulePermitReminder(permit: Permit, registration: string): Promise<string | null> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  if (permit.notification_id) {
    await Notifications.cancelScheduledNotificationAsync(permit.notification_id).catch(() => {});
  }

  const { amberDays } = getThresholds();
  const expiry = new Date(permit.expiry_date);
  const triggerDate = new Date(expiry);
  triggerDate.setDate(triggerDate.getDate() - amberDays);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate <= new Date()) return null;

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎫 Permit Expiring Soon`,
      body: `${permit.label} for ${registration} expires on ${expiry.toLocaleDateString('en-GB')}`,
      data: { vehicleId: permit.vehicle_id, permitId: permit.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notifId;
}

// ── HGV check reminders ───────────────────────────────────────────────────────

export function getHgvNextDueDate(check: HgvCheck): Date | null {
  if (!check.last_done_date) return null;
  const last = new Date(check.last_done_date);
  const next = new Date(last);
  next.setDate(next.getDate() + check.interval_days);
  return next;
}

export async function scheduleHgvReminder(check: HgvCheck, registration: string): Promise<string | null> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  if (check.notification_id) {
    await Notifications.cancelScheduledNotificationAsync(check.notification_id).catch(() => {});
  }

  const nextDue = getHgvNextDueDate(check);
  if (!nextDue) return null;

  const { amberDays } = getThresholds();
  const triggerDate = new Date(nextDue);
  triggerDate.setDate(triggerDate.getDate() - amberDays);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate <= new Date()) return null;

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚛 HGV Check Due Soon`,
      body: `${check.check_type} for ${registration} — due ${nextDue.toLocaleDateString('en-GB')}`,
      data: { vehicleId: check.vehicle_id, checkId: check.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notifId;
}
