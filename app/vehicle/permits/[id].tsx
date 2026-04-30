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
  getVehicleById, getPermits, insertPermit, updatePermit,
  deletePermit, Permit, PermitType, Vehicle,
} from '../../../services/db';
import { schedulePermitReminder } from '../../../services/notifications';
import { Colors } from '../../../constants/colors';

const PERMIT_TYPES: { value: PermitType; label: string; icon: string; color: string }[] = [
  { value: 'dart_charge', label: 'Dart Charge',   icon: 'car-outline',               color: '#5AC8FA' },
  { value: 'm6_toll',     label: 'M6 Toll',        icon: 'navigate-outline',          color: '#FF9500' },
  { value: 'parking',     label: 'Parking Permit', icon: 'location-outline',          color: '#34C759' },
  { value: 'ulez',        label: 'ULEZ',           icon: 'leaf-outline',              color: '#30D158' },
  { value: 'caz',         label: 'Clean Air Zone', icon: 'cloud-outline',             color: '#64D2FF' },
  { value: 'custom',      label: 'Other',          icon: 'ellipsis-horizontal-circle-outline', color: Colors.textMuted },
];

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function statusColor(days: number): string {
  if (days < 0) return Colors.red;
  if (days <= 14) return Colors.red;
  if (days <= 30) return '#FF9500';
  return Colors.green;
}

export default function PermitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Permit | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [label, setLabel] = useState('');
  const [type, setType] = useState<PermitType>('dart_charge');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      setPermits(getPermits(Number(id)));
    }, [id])
  );

  const openAdd = () => {
    setEditing(null);
    setLabel('');
    setType('dart_charge');
    setExpiryDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setModalVisible(true);
  };

  const openEdit = (p: Permit) => {
    setEditing(p);
    setLabel(p.label);
    setType(p.type);
    setExpiryDate(p.expiry_date);
    setNotes(p.notes ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert('Missing name', 'Please enter a name for this permit.');
      return;
    }
    if (!expiryDate) {
      Alert.alert('Missing date', 'Please set an expiry date.');
      return;
    }

    if (editing) {
      updatePermit(editing.id, {
        label: label.trim(),
        type,
        expiry_date: expiryDate,
        notes: notes.trim() || null,
      });
      const updated = getPermits(Number(id)).find(p => p.id === editing.id)!;
      if (updated && vehicle) {
        const notifId = await schedulePermitReminder(updated, vehicle.registration_number);
        if (notifId) updatePermit(updated.id, { notification_id: notifId });
      }
    } else {
      const newId = insertPermit({
        vehicle_id: Number(id),
        label: label.trim(),
        type,
        expiry_date: expiryDate,
        notes: notes.trim() || null,
        notification_id: null,
      });
      const inserted = getPermits(Number(id)).find(p => p.id === newId)!;
      if (inserted && vehicle) {
        const notifId = await schedulePermitReminder(inserted, vehicle.registration_number);
        if (notifId) updatePermit(inserted.id, { notification_id: notifId });
      }
    }

    setPermits(getPermits(Number(id)));
    setModalVisible(false);
  };

  const handleDelete = (p: Permit) => {
    Alert.alert('Delete Permit', `Remove "${p.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deletePermit(p.id);
          setPermits(getPermits(Number(id)));
        },
      },
    ]);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const expiring = permits.filter(p => daysUntil(p.expiry_date) <= 30).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Passes & Permits</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {permits.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{permits.length}</Text>
            <Text style={styles.statLabel}>Permits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, expiring > 0 && { color: '#FF9500' }]}>{expiring}</Text>
            <Text style={styles.statLabel}>Expiring soon</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {permits.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="ticket-outline" size={52} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No permits saved</Text>
            <Text style={styles.emptyText}>
              Track your Dart Charge account, M6 Toll pass, parking permits, ULEZ and Clean Air Zone exemptions.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Add first permit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          permits.map(p => {
            const typeInfo = PERMIT_TYPES.find(t => t.value === p.type)!;
            const days = daysUntil(p.expiry_date);
            const color = statusColor(days);
            return (
              <View key={p.id} style={[styles.card, { borderLeftColor: color }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '22' }]}>
                    <Ionicons name={typeInfo.icon as any} size={18} color={typeInfo.color} />
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardLabel}>{p.label}</Text>
                    <Text style={styles.cardMeta}>{typeInfo.label}</Text>
                    {p.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{p.notes}</Text> : null}
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[styles.expiryDate, { color }]}>{formatDate(p.expiry_date)}</Text>
                    <Text style={[styles.daysLabel, { color }]}>
                      {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days}d left`}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => openEdit(p)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
                    <Text style={styles.actionLabel}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(p)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={Colors.red} />
                    <Text style={[styles.actionLabel, { color: Colors.red }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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
              <Text style={styles.modalTitle}>{editing ? 'Edit Permit' : 'Add Permit'}</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Permit Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Dartford Pass, Town Centre Permit"
                placeholderTextColor={Colors.textDim}
                value={label}
                onChangeText={setLabel}
                autoFocus={!editing}
                maxLength={50}
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {PERMIT_TYPES.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, type === opt.value && styles.chipActive]}
                    onPress={() => setType(opt.value)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={13}
                      color={type === opt.value ? Colors.white : Colors.textMuted}
                    />
                    <Text style={[styles.chipText, type === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Expiry Date</Text>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.dateText}>
                  {expiryDate
                    ? new Date(expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Select date'}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textDim} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate ? new Date(expiryDate) : new Date()}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setExpiryDate(date.toISOString().split('T')[0]);
                  }}
                />
              )}

              <Text style={styles.fieldLabel}>
                Notes <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Account number, renewal instructions..."
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
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    marginTop: 16, backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },

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
  typeIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  cardMain: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  cardNotes: { fontSize: 11, color: Colors.textDim },
  cardRight: { alignItems: 'flex-end', gap: 3 },
  expiryDate: { fontSize: 13, fontWeight: '600' },
  daysLabel: { fontSize: 11 },

  cardActions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 14, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 8,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 12, color: Colors.textMuted },

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
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textMuted },
  chipTextActive: { color: Colors.white, fontWeight: '600' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateText: { flex: 1, color: Colors.text, fontSize: 14 },
});
