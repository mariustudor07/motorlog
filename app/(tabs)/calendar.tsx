import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllReminders } from '../../services/db';
import { Colors } from '../../constants/colors';

type ReminderRow = {
  id: number;
  vehicle_id: number;
  type: string;
  due_date: string;
  days_before: number;
  registration_number: string;
  make: string;
};

type MarkedDates = Record<string, {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
}>;

const TYPE_COLORS: Record<string, string> = {
  mot: Colors.primary,
  tax: Colors.amber,
  insurance: Colors.green,
};

const TYPE_LABELS: Record<string, string> = {
  mot: 'MOT',
  tax: 'Road Tax',
  insurance: 'Insurance',
};

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CalendarScreen() {
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [selectedDate, setSelectedDate] = useState('');

  useFocusEffect(
    useCallback(() => {
      const all = getAllReminders() as ReminderRow[];
      // Keep only the actual due-date reminder (days_before === 1 closest to due)
      // Show the actual expiry dates, not all reminder notifications
      const unique = Object.values(
        all.reduce((acc, r) => {
          const key = `${r.vehicle_id}-${r.type}`;
          if (!acc[key] || r.days_before < acc[key].days_before) acc[key] = r;
          return acc;
        }, {} as Record<string, ReminderRow>)
      );
      setReminders(unique);
    }, [])
  );

  const markedDates: MarkedDates = {};
  reminders.forEach(r => {
    const key = r.due_date;
    if (!markedDates[key]) markedDates[key] = { marked: true, dotColor: TYPE_COLORS[r.type] ?? Colors.primary };
  });
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: Colors.primaryDark,
    };
  }

  const todayEvents = reminders.filter(r => r.due_date === selectedDate);
  const upcoming = reminders
    .filter(r => daysUntil(r.due_date) >= 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 10);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.subtitle}>Upcoming vehicle events</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Calendar
          onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          theme={{
            backgroundColor: Colors.background,
            calendarBackground: Colors.surface,
            textSectionTitleColor: Colors.textMuted,
            selectedDayBackgroundColor: Colors.primaryDark,
            selectedDayTextColor: Colors.white,
            todayTextColor: Colors.primary,
            dayTextColor: Colors.text,
            textDisabledColor: Colors.textDim,
            dotColor: Colors.primary,
            selectedDotColor: Colors.white,
            arrowColor: Colors.primary,
            monthTextColor: Colors.text,
            indicatorColor: Colors.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
          }}
          style={styles.calendar}
        />

        <View style={styles.legendRow}>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TYPE_COLORS[type] }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>

        {selectedDate && todayEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{formatDisplayDate(selectedDate)}</Text>
            {todayEvents.map(r => (
              <EventCard key={r.id} reminder={r} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.noEvents}>No upcoming events. Add vehicles to see reminders.</Text>
          ) : (
            upcoming.map(r => <EventCard key={r.id} reminder={r} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({ reminder: r }: { reminder: ReminderRow }) {
  const days = daysUntil(r.due_date);
  const isOverdue = days < 0;
  const isUrgent = days <= 7;
  const dotColor = TYPE_COLORS[r.type] ?? Colors.primary;

  return (
    <View style={styles.eventCard}>
      <View style={[styles.eventDot, { backgroundColor: dotColor }]} />
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle}>{r.registration_number} — {TYPE_LABELS[r.type] ?? r.type}</Text>
        <Text style={styles.eventMake}>{r.make}</Text>
        <Text style={styles.eventDate}>{formatDisplayDate(r.due_date)}</Text>
      </View>
      <View style={[
        styles.daysChip,
        isOverdue ? styles.chipOverdue : isUrgent ? styles.chipUrgent : styles.chipOk,
      ]}>
        <Text style={[
          styles.daysText,
          isOverdue ? { color: Colors.red } : isUrgent ? { color: Colors.amber } : { color: Colors.green },
        ]}>
          {isOverdue ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  calendar: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.textMuted, fontSize: 12 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  noEvents: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  eventContent: { flex: 1 },
  eventTitle: { color: Colors.text, fontWeight: '600', fontSize: 14 },
  eventMake: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  eventDate: { color: Colors.textDim, fontSize: 12, marginTop: 2 },
  daysChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipOk: { backgroundColor: Colors.greenDim },
  chipUrgent: { backgroundColor: Colors.amberDim },
  chipOverdue: { backgroundColor: Colors.redDim },
  daysText: { fontSize: 12, fontWeight: '700' },
});
