import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getVehicleById, getHgvChecks, insertHgvCheck, updateHgvCheck,
  deleteHgvCheck, HgvCheck, Vehicle,
} from '../../../services/db';
import { scheduleHgvReminder, getHgvNextDueDate } from '../../../services/notifications';
import { Colors } from '../../../constants/colors';

const PRESET_CHECKS: { label: string; intervalDays: number }[] = [
  { label: 'Safety Inspection',       intervalDays: 42  }, // 6 weeks
  { label: 'Periodic Inspection',     intervalDays: 91  }, // 3 months
  { label: 'Tachograph Calibration',  intervalDays: 730 }, // 2 years
  { label: 'Speed Limiter Check',     intervalDays: 730 }, // 2 years
];

const INTERVAL_LABELS: Record<number, string> = {
  42:  'Every 6 weeks',
  84:  'Every 12 weeks',
  91:  'Every 3 months',
  182: 'Every 6 months',
  365: 'Every 12 months',
  730: 'Every 2 years',
};

function intervalLabel(days: number): string {
  return INTERVAL_LABELS[days] ?? `Every ${days} days`;
}

function statusColor(daysLeft: number | null): string {
  if (daysLeft === null) return Colors.textDim;
  if (daysLeft < 0) return Colors.red;
  if (daysLeft <= 14) return Colors.red;
  if (daysLeft <= 30) return '#FF9500';
  return Colors.green;
}

export default function HgvChecksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [checks, setChecks] = useState<HgvCheck[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<HgvCheck | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [checkType, setCheckType] = useState('');
  const [intervalDays, setIntervalDays] = useState('42');
  const [lastDoneDate, setLastDoneDate] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      setChecks(getHgvChecks(Number(id)));
    }, [id])
  );

  const openAdd = (preset?: { label: string; intervalDays: number }) => {
    setEditing(null);
    setCheckType(preset?.label ?? '');
    setIntervalDays(String(preset?.intervalDays ?? 42));
    setLastDoneDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setModalVisible(true);
  };

  const openEdit = (c: HgvCheck) => {
    setEditing(c);
    setCheckType(c.check_type);
    setIntervalDays(String(c.interval_days));
    setLastDoneDate(c.last_done_date ?? new Date().toISOString().split('T')[0]);
    setNotes(c.notes ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!checkType.trim()) {
      Alert.alert('Missing name', 'Please enter a check type.');
      return;
    }
    const intDays = parseInt(intervalDays);
    if (isNaN(intDays) || intDays < 1) {
      Alert.alert('Invalid interval', 'Please enter a valid interval in days.');
      return;
    }

    if (editing) {
      updateHgvCheck(editing.id, {
        check_type: checkType.trim(),
        interval_days: intDays,
        last_done_date: lastDoneDate || null,
        notes: notes.trim() || null,
      });
      const updated = getHgvChecks(Number(id)).find(c => c.id === editing.id)!;
      if (updated && vehicle) {
        const notifId = await scheduleHgvReminder(updated, vehicle.registration_number);
        if (notifId) updateHgvCheck(updated.id, { notification_id: notifId });
      }
    } else {
      const newId = insertHgvCheck({
        vehicle_id: Number(id),
        check_type: checkType.trim(),
        interval_days: intDays,
        last_done_date: lastDoneDate || null,
        notes: notes.trim() || null,
        notification_id: null,
      });
      const inserted = getHgvChecks(Number(id)).find(c => c.id === newId)!;
      if (inserted && vehicle) {
        const notifId = await scheduleHgvReminder(inserted, vehicle.registration_number);
        if (notifId) updateHgvCheck(inserted.id, { notification_id: notifId });
      }
    }

    setChecks(getHgvChecks(Number(id)));
    setModalVisible(false);
  };

  const handleMarkDone = async (check: HgvCheck) => {
    const today = new Date().toISOString().split('T')[0];
    updateHgvCheck(check.id, { last_done_date: today });
    const updated = getHgvChecks(Number(id)).find(c => c.id === check.id)!;
    if (updated && vehicle) {
      const notifId = await scheduleHgvReminder(updated, vehicle.registration_number);
      if (notifId) updateHgvCheck(updated.id, { notification_id: notifId });
    }
    setChecks(getHgvChecks(Number(id)));
  };

  const handleDelete = (c: HgvCheck) => {
    Alert.alert('Delete Check', `Remove "${c.check_type}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteHgvCheck(c.id);
          setChecks(getHgvChecks(Number(id)));
        },
      },
    ]);
  };

  const overdueCount = checks.filter(c => {
    const next = getHgvNextDueDate(c);
    return next && next < new Date();
  }).length;

  const existingTypes = new Set(checks.map(c => c.check_type));
  const availablePresets = PRESET_CHECKS.filter(p => !existingTypes.has(p.label));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>HGV Checks</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => openAdd()} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {checks.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{checks.length}</Text>
            <Text style={styles.statLabel}>Checks tracked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, overdueCount > 0 && { color: Colors.red }]}>{overdueCount}</Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {checks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={52} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No checks set up</Text>
            <Text style={styles.emptyText}>
              Track mandatory HGV inspection intervals — safety checks, periodic inspections and tachograph calibrations.
            </Text>
            {availablePresets.length > 0 && (
              <>
                <Text style={styles.presetsTitle}>Quick add</Text>
                {availablePresets.map(p => (
                  <TouchableOpacity key={p.label} style={styles.presetBtn} onPress={() => openAdd(p)}>
                    <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                    <Text style={styles.presetBtnText}>{p.label}</Text>
                    <Text style={styles.presetInterval}>{intervalLabel(p.intervalDays)}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        ) : (
          <>
            {availablePresets.length > 0 && (
              <View style={styles.quickAdd}>
                <Text style={styles.quickAddTitle}>Quick add</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {availablePresets.map(p => (
                    <TouchableOpacity key={p.label} style={styles.quickChip} onPress={() => openAdd(p)}>
                      <Ionicons name="add" size={13} color={Colors.primary} />
                      <Text style={styles.quickChipText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {checks.map(c => {
              const nextDue = getHgvNextDueDate(c);
              const daysLeft = nextDue ? Math.ceil((nextDue.getTime() - Date.now()) / 86400000) : null;
              const color = statusColor(daysLeft);

              return (
                <View key={c.id} style={[styles.card, { borderLeftColor: color }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardLabel}>{c.check_type}</Text>
                      <Text style={styles.cardInterval}>{intervalLabel(c.interval_days)}</Text>
                      {c.last_done_date ? (
                        <Text style={styles.cardLastDone}>
                          Last done: {new Date(c.last_done_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      ) : (
                        <Text style={[styles.cardLastDone, { color: Colors.textDim }]}>Not yet recorded</Text>
                      )}
                      {c.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{c.notes}</Text> : null}
                    </View>
                    <View style={styles.cardRight}>
                      {nextDue ? (
                        <>
                          <Text style={[styles.nextDate, { color }]}>
                            {nextDue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Text>
                          <Text style={[styles.daysLeft, { color }]}>
                            {daysLeft! < 0
                              ? `${Math.abs(daysLeft!)}d overdue`
                              : daysLeft === 0 ? 'Due today'
                              : `${daysLeft}d left`}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.notSet}>Not set</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={() => handleMarkDone(c)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={15} color={Colors.green} />
                      <Text style={[styles.actionLabel, { color: Colors.green }]}>Mark done today</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      onPress={() => openEdit(c)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(c)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editing ? 'Edit Check' : 'Add Check'}</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Check Type</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Safety Inspection, Tachograph Calibration"
                placeholderTextColor={Colors.textDim}
                value={checkType}
                onChangeText={setCheckType}
                autoFocus={!editing}
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>Interval</Text>
              <View style={styles.intervalRow}>
                {[42, 91, 182, 365, 730].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.intervalChip, intervalDays === String(d) && styles.intervalChipActive]}
                    onPress={() => setIntervalDays(String(d))}
                  >
                    <Text style={[styles.intervalChipText, intervalDays === String(d) && styles.intervalChipTextActive]}>
                      {intervalLabel(d)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customIntervalRow}>
                <Text style={styles.customIntervalLabel}>Or enter days:</Text>
                <TextInput
                  style={[styles.input, styles.intervalInput]}
                  keyboardType="number-pad"
                  value={intervalDays}
                  onChangeText={v => setIntervalDays(v.replace(/[^0-9]/g, ''))}
                  maxLength={4}
                />
              </View>

              <Text style={styles.fieldLabel}>Last Completed</Text>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.dateText}>
                  {lastDoneDate
                    ? new Date(lastDoneDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Select date'}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textDim} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={lastDoneDate ? new Date(lastDoneDate) : new Date()}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setLastDoneDate(date.toISOString().split('T')[0]);
                  }}
                />
              )}

              {lastDoneDate && intervalDays && !isNaN(parseInt(intervalDays)) && (
                <View style={styles.nextDueHint}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.nextDueHintText}>
                    Next due: {new Date(
                      new Date(lastDoneDate).getTime() + parseInt(intervalDays) * 86400000
                    ).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>
                Notes <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Garage name, certificate number..."
                placeholderTextColor={Colors.textDim}
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  addBtn: { padding: 6 },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: 16,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textDim, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  scroll: { padding: 16, paddingTop: 4, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  presetsTitle: { fontSize: 12, fontWeight: '600', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, alignSelf: 'flex-start' },
  presetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
    width: '100%', borderWidth: 1, borderColor: Colors.border,
  },
  presetBtnText: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '500' },
  presetInterval: { fontSize: 11, color: Colors.textDim },

  quickAdd: { marginBottom: 14 },
  quickAddTitle: { fontSize: 11, fontWeight: '600', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickChipText: { color: Colors.primary, fontSize: 12, fontWeight: '500' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, gap: 12,
  },
  cardMain: { flex: 1, gap: 3 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardInterval: { fontSize: 12, color: Colors.textMuted },
  cardLastDone: { fontSize: 12, color: Colors.textMuted },
  cardNotes: { fontSize: 11, color: Colors.textDim },
  cardRight: { alignItems: 'flex-end', gap: 3 },
  nextDate: { fontSize: 13, fontWeight: '600' },
  daysLeft: { fontSize: 11 },
  notSet: { fontSize: 12, color: Colors.textDim },

  cardActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 8,
  },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 12, color: Colors.textMuted },
  iconBtn: { padding: 4 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalCancel: { fontSize: 15, color: Colors.textMuted },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSave: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  modalScroll: { padding: 20, paddingBottom: 60 },

  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 18,
  },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  intervalRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  intervalChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  intervalChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  intervalChipText: { fontSize: 12, color: Colors.textMuted },
  intervalChipTextActive: { color: Colors.white, fontWeight: '600' },
  customIntervalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  customIntervalLabel: { fontSize: 13, color: Colors.textDim },
  intervalInput: { width: 80, textAlign: 'center' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateText: { flex: 1, color: Colors.text, fontSize: 14 },
  nextDueHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
  },
  nextDueHintText: { fontSize: 12, color: Colors.textMuted, flex: 1 },
});
