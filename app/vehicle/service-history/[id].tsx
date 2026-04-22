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
  getVehicleById, getServiceHistory, insertServiceRecord,
  updateServiceRecord, deleteServiceRecord, ServiceRecord, Vehicle,
} from '../../../services/db';
import { Colors } from '../../../constants/colors';

const SERVICE_TYPES = [
  'Full Service', 'Oil & Filter', 'Tyres', 'Brakes', 'MOT',
  'Timing Belt', 'Battery', 'Clutch', 'Gearbox', 'Other',
];

type FormState = {
  service_date: string;
  mileage: string;
  service_type: string;
  cost: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  service_date: new Date().toISOString().split('T')[0],
  mileage: '',
  service_type: 'Full Service',
  cost: '',
  notes: '',
});

export default function ServiceHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      setRecords(getServiceHistory(Number(id)));
    }, [id])
  );

  const openAdd = () => {
    setEditingRecord(null);
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = (r: ServiceRecord) => {
    setEditingRecord(r);
    setForm({
      service_date: r.service_date,
      mileage: r.mileage != null ? String(r.mileage) : '',
      service_type: r.service_type,
      cost: r.cost != null ? String(r.cost) : '',
      notes: r.notes ?? '',
    });
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.service_type.trim()) {
      Alert.alert('Missing info', 'Please select or enter a service type.');
      return;
    }
    if (!form.service_date) {
      Alert.alert('Missing info', 'Please set a service date.');
      return;
    }

    const payload = {
      vehicle_id: Number(id),
      service_date: form.service_date,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      service_type: form.service_type.trim(),
      cost: form.cost ? parseFloat(form.cost) : null,
      notes: form.notes.trim() || null,
    };

    if (editingRecord) {
      updateServiceRecord(editingRecord.id, {
        service_date: payload.service_date,
        mileage: payload.mileage,
        service_type: payload.service_type,
        cost: payload.cost,
        notes: payload.notes,
      });
    } else {
      insertServiceRecord(payload);
    }

    setRecords(getServiceHistory(Number(id)));
    setModalVisible(false);
  };

  const handleDelete = (r: ServiceRecord) => {
    Alert.alert(
      'Delete Record',
      `Delete this ${r.service_type} entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            deleteServiceRecord(r.id);
            setRecords(getServiceHistory(Number(id)));
          },
        },
      ]
    );
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const totalSpend = records.reduce((sum, r) => sum + (r.cost ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Service History</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      {records.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{records.length}</Text>
            <Text style={styles.summaryLabel}>Records</Text>
          </View>
          {totalSpend > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>£{totalSpend.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>Total spent</Text>
            </View>
          )}
          {records[0] && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{formatDate(records[0].service_date)}</Text>
              <Text style={styles.summaryLabel}>Last service</Text>
            </View>
          )}
        </View>
      )}

      {/* Records list */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {records.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={48} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No service records yet</Text>
            <Text style={styles.emptyText}>Tap + to log your first service, oil change, tyre replacement, or anything else you've had done.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Add first record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          records.map((r) => (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => openEdit(r)} activeOpacity={0.75}>
              <View style={styles.cardLeft}>
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{r.service_type}</Text>
                </View>
                <Text style={styles.cardDate}>{formatDate(r.service_date)}</Text>
                {r.mileage != null && (
                  <Text style={styles.cardMeta}>{r.mileage.toLocaleString()} mi</Text>
                )}
                {r.notes ? <Text style={styles.cardNotes} numberOfLines={2}>{r.notes}</Text> : null}
              </View>
              <View style={styles.cardRight}>
                {r.cost != null && (
                  <Text style={styles.cardCost}>£{r.cost.toFixed(2)}</Text>
                )}
                <TouchableOpacity onPress={() => handleDelete(r)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={Colors.red} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingRecord ? 'Edit Record' : 'Add Service Record'}</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

              {/* Service type chips */}
              <Text style={styles.fieldLabel}>Service Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {SERVICE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, form.service_type === t && styles.chipActive]}
                    onPress={() => setForm(f => ({ ...f, service_type: t }))}
                  >
                    <Text style={[styles.chipText, form.service_type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={styles.input}
                placeholder="Or type a custom service..."
                placeholderTextColor={Colors.textDim}
                value={form.service_type}
                onChangeText={v => setForm(f => ({ ...f, service_type: v }))}
              />

              {/* Date */}
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.dateText}>
                  {new Date(form.service_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textDim} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(form.service_date)}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setForm(f => ({ ...f, service_date: date.toISOString().split('T')[0] }));
                  }}
                />
              )}

              {/* Mileage */}
              <Text style={styles.fieldLabel}>Mileage <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 45000"
                placeholderTextColor={Colors.textDim}
                keyboardType="numeric"
                value={form.mileage}
                onChangeText={v => setForm(f => ({ ...f, mileage: v.replace(/[^0-9]/g, '') }))}
              />

              {/* Cost */}
              <Text style={styles.fieldLabel}>Cost (£) <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 120.00"
                placeholderTextColor={Colors.textDim}
                keyboardType="decimal-pad"
                value={form.cost}
                onChangeText={v => setForm(f => ({ ...f, cost: v.replace(/[^0-9.]/g, '') }))}
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Replaced front tyres, left rear tyre had a slow puncture..."
                placeholderTextColor={Colors.textDim}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
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

  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.textDim, marginTop: 2 },

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
    padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  cardLeft: { flex: 1, gap: 4 },
  typeChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDark,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  typeChipText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  cardDate: { fontSize: 13, color: Colors.textMuted },
  cardMeta: { fontSize: 12, color: Colors.textDim },
  cardNotes: { fontSize: 12, color: Colors.textDim, lineHeight: 16, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  cardCost: { fontSize: 15, fontWeight: '700', color: Colors.green },
  deleteBtn: { padding: 2 },

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

  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 18 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  chipsScroll: { marginBottom: 10 },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.surface, marginRight: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: Colors.white, fontWeight: '600' },

  input: {
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  textArea: { minHeight: 90 },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateText: { flex: 1, color: Colors.text, fontSize: 14 },
});
