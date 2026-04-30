import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  getVehicleById, Vehicle,
  getServiceHistoryForExport, getMileageLogForExport, getFuelLogForExport,
  getPermits, getInstallments, getChecklistLogs,
} from '../../../services/db';
import { Colors } from '../../../constants/colors';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsv).join(',');
}

function buildServiceCsv(vehicleId: number, reg: string): string {
  const records = getServiceHistoryForExport(vehicleId);
  const header = toCsvRow(['Date', 'Type', 'Mileage', 'Cost (£)', 'Notes', 'Vehicle']);
  const rows = records.map(r => toCsvRow([r.service_date, r.service_type, r.mileage, r.cost, r.notes, reg]));
  return [header, ...rows].join('\n');
}

function buildMileageCsv(vehicleId: number, reg: string): string {
  const entries = getMileageLogForExport(vehicleId);
  const header = toCsvRow(['Date', 'Mileage (mi)', 'Notes', 'Vehicle']);
  const rows = entries.map(e => toCsvRow([e.log_date, e.mileage, e.notes, reg]));
  return [header, ...rows].join('\n');
}

function buildFuelCsv(vehicleId: number, reg: string): string {
  const entries = getFuelLogForExport(vehicleId);
  const header = toCsvRow(['Date', 'Litres', 'Cost (£)', 'Mileage (mi)', 'Full Tank', 'Station', 'Notes', 'Vehicle']);
  const rows = entries.map(e => toCsvRow([
    e.fill_date, e.litres, e.cost, e.mileage,
    e.full_tank ? 'Yes' : 'No', e.station, e.notes, reg,
  ]));
  return [header, ...rows].join('\n');
}

function buildPermitsCsv(vehicleId: number, reg: string): string {
  const items = getPermits(vehicleId);
  const header = toCsvRow(['Label', 'Type', 'Expiry Date', 'Notes', 'Vehicle']);
  const rows = items.map(p => toCsvRow([p.label, p.type, p.expiry_date, p.notes, reg]));
  return [header, ...rows].join('\n');
}

function buildInstallmentsCsv(vehicleId: number, reg: string): string {
  const items = getInstallments(vehicleId);
  const header = toCsvRow(['Label', 'Type', 'Amount (£)', 'Payment Day', 'Active', 'Notes', 'Vehicle']);
  const rows = items.map(i => toCsvRow([i.label, i.type, i.amount, i.payment_day, i.active ? 'Yes' : 'No', i.notes, reg]));
  return [header, ...rows].join('\n');
}

function buildChecklistCsv(vehicleId: number, reg: string): string {
  const logs = getChecklistLogs(vehicleId);
  const header = toCsvRow(['Completed At', 'Mileage (mi)', 'Vehicle']);
  const rows = logs.map(l => toCsvRow([l.completed_at, l.mileage, reg]));
  return [header, ...rows].join('\n');
}

// ── Export options ────────────────────────────────────────────────────────────

type ExportOption = {
  key: string;
  label: string;
  sublabel: string;
  icon: string;
  build: (vehicleId: number, reg: string) => string;
  filename: (reg: string) => string;
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    key: 'service',
    label: 'Service History',
    sublabel: 'All logged services, repairs & tyres',
    icon: 'construct-outline',
    build: buildServiceCsv,
    filename: reg => `${reg}_service_history.csv`,
  },
  {
    key: 'fuel',
    label: 'Fuel Log',
    sublabel: 'All fill-ups with cost and litres',
    icon: 'water-outline',
    build: buildFuelCsv,
    filename: reg => `${reg}_fuel_log.csv`,
  },
  {
    key: 'mileage',
    label: 'Mileage Log',
    sublabel: 'Odometer readings over time',
    icon: 'speedometer-outline',
    build: buildMileageCsv,
    filename: reg => `${reg}_mileage_log.csv`,
  },
  {
    key: 'permits',
    label: 'Passes & Permits',
    sublabel: 'Dart Charge, M6 Toll, parking etc.',
    icon: 'ticket-outline',
    build: buildPermitsCsv,
    filename: reg => `${reg}_permits.csv`,
  },
  {
    key: 'payments',
    label: 'Monthly Payments',
    sublabel: 'Finance, insurance & recurring costs',
    icon: 'card-outline',
    build: buildInstallmentsCsv,
    filename: reg => `${reg}_payments.csv`,
  },
  {
    key: 'checklist',
    label: 'Pre-Drive Check Log',
    sublabel: 'History of completed pre-drive checks',
    icon: 'checkbox-outline',
    build: buildChecklistCsv,
    filename: reg => `${reg}_checklist_log.csv`,
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setVehicle(getVehicleById(Number(id)));
    }, [id])
  );

  const handleExport = async (option: ExportOption) => {
    if (!vehicle) return;
    setExporting(option.key);

    try {
      const csv = option.build(vehicle.id, vehicle.registration_number);
      const filename = option.filename(vehicle.registration_number.replace(/\s/g, ''));
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', `File saved to:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${option.label}`,
        UTI: 'public.comma-separated-values-text',
      });
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Something went wrong.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    if (!vehicle) return;
    setExporting('all');

    try {
      const reg = vehicle.registration_number.replace(/\s/g, '');
      const sections = EXPORT_OPTIONS.map(opt => {
        const csv = opt.build(vehicle.id, vehicle.registration_number);
        return `=== ${opt.label.toUpperCase()} ===\n${csv}`;
      }).join('\n\n');

      const filename = `${reg}_full_export.csv`;
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, sections, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Full Export — ${vehicle.registration_number}`,
        });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Something went wrong.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Export Data</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Export your vehicle data as CSV files — open in Excel, Google Sheets, or send to your accountant for mileage claims.
        </Text>

        {/* Export all */}
        <TouchableOpacity
          style={styles.exportAllBtn}
          onPress={handleExportAll}
          disabled={exporting !== null}
        >
          {exporting === 'all'
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Ionicons name="download-outline" size={20} color={Colors.white} />
          }
          <Text style={styles.exportAllText}>Export Everything</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Export Individual Sections</Text>

        {EXPORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.optionCard, exporting === opt.key && styles.optionCardLoading]}
            onPress={() => handleExport(opt)}
            disabled={exporting !== null}
          >
            <View style={styles.optionIcon}>
              <Ionicons name={opt.icon as any} size={20} color={Colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionSub}>{opt.sublabel}</Text>
            </View>
            {exporting === opt.key
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="share-outline" size={18} color={Colors.textDim} />
            }
          </TouchableOpacity>
        ))}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textDim} />
          <Text style={styles.footerText}>
            Files are exported as CSV and shared via your device's standard share sheet (email, Files app, WhatsApp etc.)
          </Text>
        </View>
      </ScrollView>
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

  scroll: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  intro: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 16 },

  exportAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, marginBottom: 24,
  },
  exportAllText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  optionCardLoading: { opacity: 0.6 },
  optionIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  optionContent: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  optionSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  footer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 8, padding: 12,
    backgroundColor: Colors.surface, borderRadius: 10,
  },
  footerText: { flex: 1, fontSize: 12, color: Colors.textDim, lineHeight: 17 },
});
