import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVehicleById, updateVehicle, deleteVehicle, Vehicle, getVehicleNotes, saveVehicleNotes } from '../../services/db';
import { cancelRemindersForVehicle, scheduleRemindersForVehicle } from '../../services/notifications';
import { lookupVehicle } from '../../services/dvla';
import { StatusBadge } from '../../components/StatusBadge';
import { LORRY_MODE_KEY } from '../(tabs)/settings';
import { Colors } from '../../constants/colors';

type DateField = 'mot_expiry_date' | 'tax_due_date' | 'insurance_expiry_date';

const FIELD_LABELS: Record<DateField, string> = {
  mot_expiry_date: 'MOT Expiry',
  tax_due_date: 'Road Tax Due',
  insurance_expiry_date: 'Insurance Expiry',
};

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [showPicker, setShowPicker] = useState<DateField | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [lorryMode, setLorryMode] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  const handleRefresh = async () => {
    if (!vehicle || refreshing) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const fresh = await lookupVehicle(vehicle.registration_number);
      const updates = {
        make: fresh.make ?? vehicle.make,
        colour: fresh.colour ?? vehicle.colour,
        fuel_type: fresh.fuelType ?? vehicle.fuel_type,
        engine_capacity: fresh.engineCapacity ?? vehicle.engine_capacity,
        year_of_manufacture: fresh.yearOfManufacture ?? vehicle.year_of_manufacture,
        co2_emissions: fresh.co2Emissions ?? vehicle.co2_emissions,
        euro_status: fresh.euroStatus ?? vehicle.euro_status,
        mot_status: fresh.motStatus ?? vehicle.mot_status,
        tax_status: fresh.taxStatus ?? vehicle.tax_status,
        tax_due_date: fresh.taxDueDate ? fresh.taxDueDate.split('T')[0] : vehicle.tax_due_date,
        raw_dvla_json: JSON.stringify(fresh),
      };
      updateVehicle(vehicle.id, updates);
      const updated = getVehicleById(vehicle.id)!;
      setVehicle(updated);

      // Reschedule reminders if tax date changed
      if (fresh.taxDueDate) {
        await cancelRemindersForVehicle(vehicle.id);
        const dates: { type: 'mot' | 'tax' | 'insurance'; date: string | null }[] = [
          { type: 'mot', date: updated.mot_expiry_date },
          { type: 'tax', date: updated.tax_due_date },
          { type: 'insurance', date: updated.insurance_expiry_date },
        ];
        for (const { type, date } of dates) {
          if (date) {
            await scheduleRemindersForVehicle({
              vehicleId: vehicle.id,
              registration: vehicle.registration_number,
              make: vehicle.make,
              type,
              dueDate: date,
            });
          }
        }
      }
      setRefreshMsg({ text: 'Updated from DVLA ✓', ok: true });
    } catch (e: any) {
      setRefreshMsg({ text: e.message ?? 'Refresh failed', ok: false });
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 3000);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      setNotes(getVehicleNotes(Number(id)));
      setNotesDirty(false);
      AsyncStorage.getItem(LORRY_MODE_KEY).then(val => setLorryMode(val === 'true'));
    }, [id])
  );

  if (!vehicle) return null;

  const handleDateChange = async (field: DateField, date: Date) => {
    setShowPicker(null);
    const dateStr = date.toISOString().split('T')[0];
    updateVehicle(vehicle.id, { [field]: dateStr });
    setVehicle({ ...vehicle, [field]: dateStr });

    await cancelRemindersForVehicle(vehicle.id);
    const updated = { ...vehicle, [field]: dateStr };
    const datesMap: Record<DateField, string | null> = {
      mot_expiry_date: updated.mot_expiry_date,
      tax_due_date: updated.tax_due_date,
      insurance_expiry_date: updated.insurance_expiry_date,
    };
    const typeMap: Record<DateField, 'mot' | 'tax' | 'insurance'> = {
      mot_expiry_date: 'mot',
      tax_due_date: 'tax',
      insurance_expiry_date: 'insurance',
    };
    for (const [f, d] of Object.entries(datesMap) as [DateField, string | null][]) {
      if (d) {
        await scheduleRemindersForVehicle({
          vehicleId: vehicle.id,
          registration: vehicle.registration_number,
          make: vehicle.make,
          type: typeMap[f],
          dueDate: d,
        });
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.registration_number} from your list? All reminders will be cancelled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await cancelRemindersForVehicle(vehicle.id);
            deleteVehicle(vehicle.id);
            router.back();
          },
        },
      ]
    );
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not set';

  const dateFields: DateField[] = ['mot_expiry_date', 'tax_due_date', 'insurance_expiry_date'];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.reg}>{vehicle.registration_number}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.red} />
          </TouchableOpacity>
        </View>
      </View>
      {refreshMsg && (
        <View style={[styles.refreshMsg, refreshMsg.ok ? styles.refreshMsgOk : styles.refreshMsgErr]}>
          <Text style={[styles.refreshMsgText, { color: refreshMsg.ok ? Colors.green : Colors.red }]}>
            {refreshMsg.text}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.makeCard}>
          <Text style={styles.make}>{vehicle.year_of_manufacture} {vehicle.make}</Text>
          <Text style={styles.colour}>{vehicle.colour} · {vehicle.fuel_type}</Text>
          {vehicle.engine_capacity && (
            <Text style={styles.detail}>{vehicle.engine_capacity}cc</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.badgesRow}>
          <StatusBadge label="MOT" dateStr={vehicle.mot_expiry_date} />
          <StatusBadge label="Tax" dateStr={vehicle.tax_due_date} />
          <StatusBadge label="Insurance" dateStr={vehicle.insurance_expiry_date} />
        </View>

        <Text style={styles.sectionTitle}>Expiry Dates</Text>
        {dateFields.map(field => (
          <TouchableOpacity
            key={field}
            style={styles.dateRow}
            onPress={() => setShowPicker(field)}
          >
            <Text style={styles.dateLabel}>{FIELD_LABELS[field]}</Text>
            <View style={styles.dateRight}>
              <Text style={styles.dateValue}>{formatDate(vehicle[field])}</Text>
              <Ionicons name="pencil-outline" size={14} color={Colors.textDim} />
            </View>
          </TouchableOpacity>
        ))}

        {showPicker && (
          <DateTimePicker
            value={vehicle[showPicker] ? new Date(vehicle[showPicker]!) : new Date()}
            mode="date"
            display="spinner"
            themeVariant="dark"
            onChange={(_, date) => { if (date) handleDateChange(showPicker, date); else setShowPicker(null); }}
          />
        )}

        <TouchableOpacity
          style={styles.actionCardWide}
          onPress={() => router.push(`/vehicle/checklist/${vehicle.id}`)}
        >
          <Ionicons name="checkbox-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Pre-Drive Checklist</Text>
            <Text style={styles.actionSub}>Run through safety checks before a journey</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>History & Records</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/vehicle/service-history/${vehicle.id}`)}
          >
            <Ionicons name="construct-outline" size={22} color={Colors.primary} />
            <Text style={styles.actionLabel}>Service History</Text>
            <Text style={styles.actionSub}>Log services, tyres & repairs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push(`/vehicle/mot-history/${vehicle.id}`)}
          >
            <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
            <Text style={styles.actionLabel}>MOT History</Text>
            <Text style={styles.actionSub}>View past tests & advisories</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.actionCardWide}
          onPress={() => router.push(`/vehicle/mileage/${vehicle.id}`)}
        >
          <Ionicons name="speedometer-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Mileage Tracker</Text>
            <Text style={styles.actionSub}>Log odometer readings & track distance</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCardWide}
          onPress={() => router.push(`/vehicle/installments/${vehicle.id}`)}
        >
          <Ionicons name="card-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Monthly Payments</Text>
            <Text style={styles.actionSub}>Finance, insurance & recurring costs</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCardWide}
          onPress={() => router.push(`/vehicle/permits/${vehicle.id}`)}
        >
          <Ionicons name="ticket-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Passes & Permits</Text>
            <Text style={styles.actionSub}>Dart Charge, M6 Toll, parking & more</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
        </TouchableOpacity>
        {lorryMode && (
          <TouchableOpacity
            style={styles.actionCardWide}
            onPress={() => router.push(`/vehicle/hgv/${vehicle.id}`)}
          >
            <Ionicons name="bus-outline" size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>HGV Checks</Text>
              <Text style={styles.actionSub}>Safety, periodic & tachograph inspections</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
          </TouchableOpacity>
        )}

        {/* Fuel log link — in history section */}
        <TouchableOpacity
          style={styles.actionCardWide}
          onPress={() => router.push(`/vehicle/fuel/${vehicle.id}`)}
        >
          <Ionicons name="water-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Fuel Log</Text>
            <Text style={styles.actionSub}>Track fill-ups, cost & MPG</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCardWide}
          onPress={() => router.push(`/vehicle/export/${vehicle.id}`)}
        >
          <Ionicons name="share-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Export Data</Text>
            <Text style={styles.actionSub}>Download history as CSV files</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
        </TouchableOpacity>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.notesCard}>
          <TextInput
            style={styles.notesInput}
            placeholder="Anything to remember about this vehicle — upcoming jobs, known issues, reminders to yourself..."
            placeholderTextColor={Colors.textDim}
            multiline
            value={notes}
            onChangeText={v => { setNotes(v); setNotesDirty(true); }}
            textAlignVertical="top"
          />
          {notesDirty && (
            <TouchableOpacity
              style={styles.notesSaveBtn}
              onPress={() => {
                saveVehicleNotes(vehicle.id, notes);
                setNotesDirty(false);
              }}
            >
              <Ionicons name="checkmark" size={14} color={Colors.white} />
              <Text style={styles.notesSaveBtnText}>Save notes</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>DVLA Details</Text>
        <InfoGrid vehicle={vehicle} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoGrid({ vehicle: v }: { vehicle: Vehicle }) {
  const rows: [string, string | number | null | undefined][] = [
    ['MOT Status', v.mot_status],
    ['Tax Status', v.tax_status],
    ['Euro Status', v.euro_status],
    ['CO₂ Emissions', v.co2_emissions ? `${v.co2_emissions} g/km` : null],
    ['Engine', v.engine_capacity ? `${v.engine_capacity}cc` : null],
    ['Year', v.year_of_manufacture],
    ['Colour', v.colour],
    ['Fuel', v.fuel_type],
  ];

  return (
    <View style={styles.grid}>
      {rows.map(([label, value]) => value ? (
        <View key={label} style={styles.gridItem}>
          <Text style={styles.gridLabel}>{label}</Text>
          <Text style={styles.gridValue}>{String(value)}</Text>
        </View>
      ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  refreshMsg: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshMsgOk: { backgroundColor: Colors.greenDim },
  refreshMsgErr: { backgroundColor: Colors.redDim },
  refreshMsgText: { fontSize: 13, fontWeight: '500' },
  reg: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  scroll: { padding: 16, paddingTop: 4 },
  makeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
  },
  make: { fontSize: 20, fontWeight: '700', color: Colors.text },
  colour: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  detail: { fontSize: 13, color: Colors.textDim, marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  dateLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  dateRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateValue: { color: Colors.textMuted, fontSize: 13 },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  actionSub: {
    fontSize: 11,
    color: Colors.textDim,
    lineHeight: 15,
  },
  actionCardWide: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  grid: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 30,
  },
  gridItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  gridLabel: { color: Colors.textMuted, fontSize: 13 },
  gridValue: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  notesCard: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20, overflow: 'hidden',
  },
  notesInput: {
    color: Colors.text, fontSize: 14, lineHeight: 20,
    paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 90,
  },
  notesSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, margin: 10, marginTop: 0,
    borderRadius: 8, paddingVertical: 9,
  },
  notesSaveBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
});
