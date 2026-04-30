import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  getAllVehicles,
  getAllPermitsWithVehicle,
  getAllHgvChecksWithVehicle,
  getAllInstallmentsWithVehicle,
} from '../../services/db';
import { getHgvNextDueDate, getNextPaymentDate } from '../../services/notifications';
import { Colors } from '../../constants/colors';

// ── Unified reminder item ─────────────────────────────────────────────────────

type ReminderItem = {
  key: string;
  vehicleId: number;
  registration: string;
  make: string;
  label: string;
  sublabel: string;
  dueDate: Date;
  daysLeft: number;
  category: 'mot' | 'tax' | 'insurance' | 'permit' | 'hgv' | 'payment';
  route: string;
};

const CATEGORY_COLOR: Record<ReminderItem['category'], string> = {
  mot:       Colors.primary,
  tax:       '#FF9500',
  insurance: Colors.green,
  permit:    '#5AC8FA',
  hgv:       '#BF5AF2',
  payment:   '#FF2D55',
};

const CATEGORY_ICON: Record<ReminderItem['category'], string> = {
  mot:       'document-text-outline',
  tax:       'receipt-outline',
  insurance: 'shield-checkmark-outline',
  permit:    'ticket-outline',
  hgv:       'bus-outline',
  payment:   'card-outline',
};

function daysUntilDate(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function urgencyColor(days: number): string {
  if (days < 0) return Colors.red;
  if (days <= 7) return Colors.red;
  if (days <= 30) return '#FF9500';
  return Colors.green;
}

function buildReminders(): ReminderItem[] {
  const items: ReminderItem[] = [];

  // 1. Vehicle expiry dates
  const vehicles = getAllVehicles();
  for (const v of vehicles) {
    const dateFields: { key: 'mot_expiry_date' | 'tax_due_date' | 'insurance_expiry_date'; cat: ReminderItem['category']; label: string }[] = [
      { key: 'mot_expiry_date',        cat: 'mot',       label: 'MOT Expiry' },
      { key: 'tax_due_date',           cat: 'tax',       label: 'Road Tax Due' },
      { key: 'insurance_expiry_date',  cat: 'insurance', label: 'Insurance Expiry' },
    ];
    for (const f of dateFields) {
      if (!v[f.key]) continue;
      const due = new Date(v[f.key]!);
      items.push({
        key: `vehicle-${v.id}-${f.cat}`,
        vehicleId: v.id,
        registration: v.registration_number,
        make: v.make,
        label: f.label,
        sublabel: v.make,
        dueDate: due,
        daysLeft: daysUntilDate(due),
        category: f.cat,
        route: `/vehicle/${v.id}`,
      });
    }
  }

  // 2. Permits
  const permits = getAllPermitsWithVehicle();
  for (const p of permits) {
    const due = new Date(p.expiry_date);
    items.push({
      key: `permit-${p.id}`,
      vehicleId: p.vehicle_id,
      registration: p.registration_number,
      make: p.make,
      label: p.label,
      sublabel: 'Permit / Pass',
      dueDate: due,
      daysLeft: daysUntilDate(due),
      category: 'permit',
      route: `/vehicle/permits/${p.vehicle_id}`,
    });
  }

  // 3. HGV checks
  const hgvChecks = getAllHgvChecksWithVehicle();
  for (const c of hgvChecks) {
    const nextDue = getHgvNextDueDate(c);
    if (!nextDue) continue;
    items.push({
      key: `hgv-${c.id}`,
      vehicleId: c.vehicle_id,
      registration: c.registration_number,
      make: c.make,
      label: c.check_type,
      sublabel: 'HGV Check',
      dueDate: nextDue,
      daysLeft: daysUntilDate(nextDue),
      category: 'hgv',
      route: `/vehicle/hgv/${c.vehicle_id}`,
    });
  }

  // 4. Monthly payments (next payment date)
  const installments = getAllInstallmentsWithVehicle();
  for (const inst of installments) {
    const nextDate = getNextPaymentDate(inst.payment_day);
    items.push({
      key: `payment-${inst.id}`,
      vehicleId: inst.vehicle_id,
      registration: inst.registration_number,
      make: inst.make,
      label: inst.label,
      sublabel: inst.amount != null ? `£${inst.amount.toFixed(2)} / month` : 'Monthly payment',
      dueDate: nextDate,
      daysLeft: daysUntilDate(nextDate),
      category: 'payment',
      route: `/vehicle/installments/${inst.vehicle_id}`,
    });
  }

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RemindersScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ReminderItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setItems(buildReminders());
    }, [])
  );

  const overdue    = items.filter(i => i.daysLeft < 0);
  const thisWeek   = items.filter(i => i.daysLeft >= 0 && i.daysLeft <= 7);
  const thisMonth  = items.filter(i => i.daysLeft > 7 && i.daysLeft <= 30);
  const upcoming   = items.filter(i => i.daysLeft > 30 && i.daysLeft <= 90);
  const later      = items.filter(i => i.daysLeft > 90);

  const allClear = items.length > 0 && overdue.length === 0 && thisWeek.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming</Text>
        <Text style={styles.subtitle}>All reminders across your vehicles</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={52} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>Nothing to track yet</Text>
            <Text style={styles.emptyText}>Add a vehicle and set its MOT, tax and insurance dates to see reminders here.</Text>
          </View>
        ) : (
          <>
            {allClear && (
              <View style={styles.allClearBanner}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
                <Text style={styles.allClearText}>Everything's up to date — nothing overdue or due this week</Text>
              </View>
            )}

            {overdue.length > 0 && (
              <Section title="Overdue" color={Colors.red} items={overdue} router={router} />
            )}
            {thisWeek.length > 0 && (
              <Section title="This Week" color={Colors.red} items={thisWeek} router={router} />
            )}
            {thisMonth.length > 0 && (
              <Section title="This Month" color='#FF9500' items={thisMonth} router={router} />
            )}
            {upcoming.length > 0 && (
              <Section title="Next 3 Months" color={Colors.textMuted} items={upcoming} router={router} />
            )}
            {later.length > 0 && (
              <Section title="Later" color={Colors.textDim} items={later} router={router} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, color, items, router }: {
  title: string;
  color: string;
  items: ReminderItem[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <Text style={styles.sectionCount}>{items.length}</Text>
      </View>
      {items.map(item => (
        <ReminderCard key={item.key} item={item} onPress={() => router.push(item.route as any)} />
      ))}
    </View>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ReminderCard({ item, onPress }: { item: ReminderItem; onPress: () => void }) {
  const color = urgencyColor(item.daysLeft);
  const catColor = CATEGORY_COLOR[item.category];
  const catIcon = CATEGORY_ICON[item.category];

  const dayLabel = item.daysLeft < 0
    ? `${Math.abs(item.daysLeft)}d overdue`
    : item.daysLeft === 0 ? 'Today'
    : item.daysLeft === 1 ? 'Tomorrow'
    : `${item.daysLeft} days`;

  const dateStr = item.dueDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.catIcon, { backgroundColor: catColor + '22' }]}>
        <Ionicons name={catIcon as any} size={17} color={catColor} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.label}</Text>
        <Text style={styles.cardReg}>{item.registration} · {item.sublabel}</Text>
        <Text style={styles.cardDate}>{dateStr}</Text>
      </View>
      <View style={[styles.daysBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.daysText, { color }]}>{dayLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  allClearBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.greenDim, borderRadius: 12,
    padding: 14, marginBottom: 16,
  },
  allClearText: { flex: 1, color: Colors.green, fontSize: 13, fontWeight: '500' },

  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, flex: 1,
  },
  sectionCount: {
    fontSize: 12, color: Colors.textDim,
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    overflow: 'hidden',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  catIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardReg: { fontSize: 12, color: Colors.textMuted },
  cardDate: { fontSize: 11, color: Colors.textDim },
  daysBadge: {
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    alignItems: 'center',
  },
  daysText: { fontSize: 12, fontWeight: '700' },
});
