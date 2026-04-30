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
  getVehicleById, getFuelLog, insertFuelEntry, deleteFuelEntry,
  FuelEntry, Vehicle,
} from '../../../services/db';
import { Colors } from '../../../constants/colors';

const LITRES_PER_GALLON = 4.54609;

function calcMpg(miles: number, litres: number): number {
  return (miles / litres) * LITRES_PER_GALLON;
}

export default function FuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [fillDate, setFillDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [litres, setLitres] = useState('');
  const [cost, setCost] = useState('');
  const [fullTank, setFullTank] = useState(true);
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      setVehicle(getVehicleById(Number(id)));
      setEntries(getFuelLog(Number(id)));
    }, [id])
  );

  const openAdd = () => {
    setFillDate(new Date().toISOString().split('T')[0]);
    setMileage('');
    setLitres('');
    setCost('');
    setFullTank(true);
    setStation('');
    setNotes('');
    setModalVisible(true);
  };

  const handleSave = () => {
    const l = parseFloat(litres);
    const c = parseFloat(cost);
    if (!litres || isNaN(l) || l <= 0) {
      Alert.alert('Invalid litres', 'Please enter how many litres you put in.');
      return;
    }
    if (!cost || isNaN(c) || c <= 0) {
      Alert.alert('Invalid cost', 'Please enter the total cost.');
      return;
    }
    const miles = mileage.trim() ? parseInt(mileage) : null;

    insertFuelEntry({
      vehicle_id: Number(id),
      fill_date: fillDate,
      mileage: miles,
      litres: l,
      cost: c,
      full_tank: fullTank ? 1 : 0,
      station: station.trim() || null,
      notes: notes.trim() || null,
    });
    setEntries(getFuelLog(Number(id)));
    setModalVisible(false);
  };

  const handleDelete = (entry: FuelEntry) => {
    Alert.alert('Delete Entry', 'Remove this fill-up record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteFuelEntry(entry.id);
          setEntries(getFuelLog(Number(id)));
        },
      },
    ]);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalSpend = entries.reduce((s, e) => s + e.cost, 0);
  const totalLitres = entries.reduce((s, e) => s + e.litres, 0);
  const avgCostPerLitre = totalLitres > 0 ? totalSpend / totalLitres : null;

  // MPG: calculate between consecutive full-tank fills that have mileage
  const fullFills = entries.filter(e => e.full_tank && e.mileage != null)
    .sort((a, b) => (a.mileage! - b.mileage!)); // ascending mileage

  const mpgReadings: number[] = [];
  for (let i = 1; i < fullFills.length; i++) {
    const miles = fullFills[i].mileage! - fullFills[i - 1].mileage!;
    if (miles > 0) {
      mpgReadings.push(calcMpg(miles, fullFills[i].litres));
    }
  }
  const avgMpg = mpgReadings.length > 0
    ? mpgReadings.reduce((s, v) => s + v, 0) / mpgReadings.length
    : null;
  const lastMpg = mpgReadings.length > 0 ? mpgReadings[mpgReadings.length - 1] : null;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Fuel Log</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {entries.length > 0 && (
        <View style={styles.statsStrip}>
          {avgMpg != null && (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{avgMpg.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Avg MPG</Text>
              </View>
              <View style={styles.statDivider} />
            </>
          )}
          {lastMpg != null && (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{lastMpg.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Last MPG</Text>
              </View>
              <View style={styles.statDivider} />
            </>
          )}
          {avgCostPerLitre != null && (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{(avgCostPerLitre * 100).toFixed(1)}p</Text>
                <Text style={styles.statLabel}>Avg per litre</Text>
              </View>
              <View style={styles.statDivider} />
            </>
          )}
          <View style={styles.statItem}>
            <Text style={styles.statNum}>£{totalSpend.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total spent</Text>
          </View>
        </View>
      )}

      {avgMpg == null && entries.length > 0 && entries.filter(e => e.full_tank && e.mileage != null).length < 2 && (
        <View style={styles.mpgHint}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.mpgHintText}>Add mileage to 2+ full-tank fill-ups to calculate MPG</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={52} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No fill-ups logged</Text>
            <Text style={styles.emptyText}>
              Log each fill-up with mileage and cost to track your fuel economy and spending over time.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Log first fill-up</Text>
            </TouchableOpacity>
          </View>
        ) : (
          entries.map((entry, idx) => {
            // MPG for this specific entry
            const sortedFull = fullFills;
            const thisIdx = sortedFull.findIndex(f => f.id === entry.id);
            let entryMpg: number | null = null;
            if (thisIdx > 0 && entry.full_tank && entry.mileage != null) {
              const prev = sortedFull[thisIdx - 1];
              const miles = entry.mileage - prev.mileage!;
              if (miles > 0) entryMpg = calcMpg(miles, entry.litres);
            }

            return (
              <View key={entry.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardCost}>£{entry.cost.toFixed(2)}</Text>
                      {!entry.full_tank && (
                        <View style={styles.partialBadge}>
                          <Text style={styles.partialBadgeText}>Partial</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardDetails}>
                      {entry.litres.toFixed(2)}L · {(entry.cost / entry.litres * 100).toFixed(1)}p/L
                    </Text>
                    {entry.mileage != null && (
                      <Text style={styles.cardMileage}>{entry.mileage.toLocaleString()} mi</Text>
                    )}
                    {entry.station ? <Text style={styles.cardStation}>{entry.station}</Text> : null}
                    {entry.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{entry.notes}</Text> : null}
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardDate}>{formatDate(entry.fill_date)}</Text>
                    {entryMpg != null && (
                      <View style={styles.mpgBadge}>
                        <Text style={styles.mpgBadgeText}>{entryMpg.toFixed(1)} MPG</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleDelete(entry)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Log Fill-Up</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Full / Partial toggle */}
              <View style={styles.tankToggleRow}>
                <TouchableOpacity
                  style={[styles.tankToggleBtn, fullTank && styles.tankToggleBtnActive]}
                  onPress={() => setFullTank(true)}
                >
                  <Ionicons name="water" size={14} color={fullTank ? Colors.white : Colors.textMuted} />
                  <Text style={[styles.tankToggleText, fullTank && styles.tankToggleTextActive]}>Full tank</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tankToggleBtn, !fullTank && styles.tankToggleBtnActive]}
                  onPress={() => setFullTank(false)}
                >
                  <Ionicons name="water-outline" size={14} color={!fullTank ? Colors.white : Colors.textMuted} />
                  <Text style={[styles.tankToggleText, !fullTank && styles.tankToggleTextActive]}>Partial</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Litres</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 45.00"
                    placeholderTextColor={Colors.textDim}
                    keyboardType="decimal-pad"
                    value={litres}
                    onChangeText={v => setLitres(v.replace(/[^0-9.]/g, ''))}
                    autoFocus
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Total Cost (£)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 68.50"
                    placeholderTextColor={Colors.textDim}
                    keyboardType="decimal-pad"
                    value={cost}
                    onChangeText={v => setCost(v.replace(/[^0-9.]/g, ''))}
                  />
                </View>
              </View>

              {litres && cost && parseFloat(litres) > 0 && parseFloat(cost) > 0 && (
                <View style={styles.calcHint}>
                  <Text style={styles.calcHintText}>
                    {(parseFloat(cost) / parseFloat(litres) * 100).toFixed(1)}p per litre
                  </Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>
                Odometer Reading <Text style={styles.optional}>(for MPG)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 54321"
                placeholderTextColor={Colors.textDim}
                keyboardType="number-pad"
                value={mileage}
                onChangeText={v => setMileage(v.replace(/[^0-9]/g, ''))}
              />

              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.dateText}>
                  {new Date(fillDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textDim} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(fillDate)}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setFillDate(date.toISOString().split('T')[0]);
                  }}
                />
              )}

              <Text style={styles.fieldLabel}>
                Station <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Tesco Petrol, Shell M6"
                placeholderTextColor={Colors.textDim}
                value={station}
                onChangeText={setStation}
                maxLength={50}
              />

              <Text style={styles.fieldLabel}>
                Notes <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Any extra notes..."
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  addBtn: { padding: 6 },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: 16,
    borderRadius: 12, padding: 14, marginBottom: 6,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 15, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textDim, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  mpgHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.surface, borderRadius: 8,
  },
  mpgHintText: { fontSize: 12, color: Colors.textMuted, flex: 1 },

  scroll: { padding: 16, paddingTop: 8, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCost: { fontSize: 20, fontWeight: '700', color: Colors.text },
  partialBadge: { backgroundColor: Colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  partialBadgeText: { fontSize: 10, color: Colors.textDim },
  cardDetails: { fontSize: 13, color: Colors.textMuted },
  cardMileage: { fontSize: 12, color: Colors.textDim },
  cardStation: { fontSize: 12, color: Colors.textDim },
  cardNotes: { fontSize: 11, color: Colors.textDim },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardDate: { fontSize: 12, color: Colors.textMuted },
  mpgBadge: { backgroundColor: Colors.primaryDark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  mpgBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
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
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  tankToggleRow: {
    flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 4,
  },
  tankToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tankToggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tankToggleText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tankToggleTextActive: { color: Colors.white, fontWeight: '700' },
  calcHint: {
    alignItems: 'center', marginTop: 6, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: 8, paddingVertical: 6,
  },
  calcHintText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
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
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateText: { flex: 1, color: Colors.text, fontSize: 14 },
});
