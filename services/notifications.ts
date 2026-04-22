import * as Notifications from 'expo-notifications';
import { upsertReminder, deleteRemindersForVehicle, getRemindersForVehicle } from './db';
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
