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
  getVehicleById, getMileageLog, insertMileageEntry,
  deleteMileageEntry, MileageEntry, Vehicle,
} from '../../../services/db';
import { Colors } from '../../../constants/colors';

export default function MileageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      setEntries(getMileageLog(Number(id)));
    }, [id])
  );

  const openAdd = () => {
    setMileage('');
    setNotes('');
    setLogDate(new Date().toISOString().split('T')[0]);
    setModalVisible(true);
  };

  const handleSave = () => {
    const miles = parseInt(mileage);
    if (!mileage || isNaN(miles) || miles <= 0) {
      Alert.alert('Invalid mileage', 'Please enter a valid mileage reading.');
      return;
    }
    insertMileageEntry({
      vehicle_id: Number(id),
      log_date: logDate,
      mileage: miles,
      notes: notes.trim() || null,
    });
    setEntries(getMileageLog(Number(id)));
    setModalVisible(false);
  };

  const handleDelete = (entry: MileageEntry) => {
    Alert.alert(
      'Delete Entry',
      `Remove the ${entry.mileage.toLocaleString()} mi reading?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            deleteMileageEntry(entry.id);
            setEntries(getMileageLog(Number(id)));
          },
        },
      ]
    );
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Stats
  const latest = entries[0]?.mileage ?? null;
  const oldest = entries[entries.length - 1]?.mileage ?? null;
  const totalDistance = entries.length >= 2 ? (entries[0].mileage - entries[entries.length - 1].mileage) : null;

  // Per-entry distance deltas (difference from previous reading)
  const withDeltas = entries.map((e, i) => ({
    ...e,
    delta: i < entries.length - 1 ? e.mileage - entries[i + 1].mileage : null,
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Mileage</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      {entries.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{latest?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Current mi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{entries.length}</Text>
            <Text style={styles.statLabel}>Readings</Text>
          </View>
          {totalDistance != null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalDistance.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total logged</Text>
              </View>
            </>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="speedometer-outline" size={52} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No mileage logged yet</Text>
            <Text style={styles.emptyText}>
              Log your odometer readings to track mileage over time. Add one after every fill-up or service.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Log first reading</Text>
            </TouchableOpacity>
          </View>
        ) : (
          withDeltas.map((entry, idx) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryLeft}>
                <Text style={styles.entryMileage}>{entry.mileage.toLocaleString()} mi</Text>
                <Text style={styles.entryDate}>{formatDate(entry.log_date)}</Text>
                {entry.notes ? (
                  <Text style={styles.entryNotes} numberOfLines={1}>{entry.notes}</Text>
                ) : null}
              </View>
              <View style={styles.entryRight}>
                {entry.delta != null ? (
                  <View style={styles.deltaBadge}>
                    <Ionicons name="arrow-up" size={10} color={Colors.primary} />
                    <Text style={styles.deltaText}>+{entry.delta.toLocaleString()}</Text>
                  </View>
                ) : (
                  <View style={styles.firstBadge}>
                    <Text style={styles.firstBadgeText}>First</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => handleDelete(entry)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Modal */}
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
              <Text style={styles.modalTitle}>Log Mileage</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Odometer Reading (miles)</Text>
              <TextInput
                style={[styles.input, styles.inputLarge]}
                placeholder="e.g. 54321"
                placeholderTextColor={Colors.textDim}
                keyboardType="numeric"
                value={mileage}
                onChangeText={v => setMileage(v.replace(/[^0-9]/g, ''))}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.dateText}>
                  {new Date(logDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textDim} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(logDate)}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setLogDate(date.toISOString().split('T')[0]);
                  }}
                />
              )}

              <Text style={styles.fieldLabel}>
                Notes <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. After fill-up, before long trip..."
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

  entryCard: {
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  entryLeft: { gap: 3 },
  entryMileage: { fontSize: 18, fontWeight: '700', color: Colors.text },
  entryDate: { fontSize: 12, color: Colors.textMuted },
  entryNotes: { fontSize: 11, color: Colors.textDim },
  entryRight: { alignItems: 'flex-end', gap: 8 },
  deltaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primaryDark, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  deltaText: { fontSize: 11, fontWeight: '600', color: Colors.text },
  firstBadge: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  firstBadgeText: { fontSize: 11, color: Colors.textDim },
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
  inputLarge: { fontSize: 28, fontWeight: '700', textAlign: 'center', paddingVertical: 16 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateText: { flex: 1, color: Colors.text, fontSize: 14 },
});
