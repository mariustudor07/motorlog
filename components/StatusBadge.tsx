import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { getThresholds } from '../services/thresholds';

export type Status = 'green' | 'amber' | 'red' | 'unknown';

export function getDaysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getStatus(dateStr: string | null): Status {
  const days = getDaysLeft(dateStr);
  if (days === null) return 'unknown';
  const { amberDays, redDays } = getThresholds();
  if (days < 0) return 'red';
  if (days <= redDays) return 'red';
  if (days <= amberDays) return 'amber';
  return 'green';
}

function statusColors(s: Status) {
  switch (s) {
    case 'green':  return { bg: Colors.greenDim,  text: Colors.green };
    case 'amber':  return { bg: Colors.amberDim,  text: Colors.amber };
    case 'red':    return { bg: Colors.redDim,    text: Colors.red };
    default:       return { bg: Colors.surfaceAlt, text: Colors.textMuted };
  }
}

function daysLabel(dateStr: string | null): string {
  const days = getDaysLeft(dateStr);
  if (days === null) return 'Not set';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

type Props = {
  label: string;
  dateStr: string | null;
};

export function StatusBadge({ label, dateStr }: Props) {
  const status = getStatus(dateStr);
  const colors = statusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{daysLabel(dateStr)}</Text>
    </View>
  );
}

export function getOverallStatus(dates: (string | null)[]): Status {
  const statuses = dates.filter(Boolean).map(d => getStatus(d));
  if (statuses.includes('red'))   return 'red';
  if (statuses.includes('amber')) return 'amber';
  if (statuses.length === 0)      return 'unknown';
  return 'green';
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 70,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
});
