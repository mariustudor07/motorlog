import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { lookupVehicle, DvlaVehicle } from '../../services/dvla';
import { Colors } from '../../constants/colors';

export default function QuickCheckScreen() {
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DvlaVehicle | null>(null);

  const handleLookup = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await lookupVehicle(plate);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPlate('');
    setResult(null);
    setError('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Check</Text>
        <Text style={styles.subtitle}>Look up any vehicle without saving it</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.inputRow}>
          <View style={styles.plateWrap}>
            <Text style={styles.platePrefix}>GB</Text>
            <TextInput
              style={styles.plateInput}
              placeholder="AB12 CDE"
              placeholderTextColor={Colors.textDim}
              value={plate}
              onChangeText={t => setPlate(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
              onSubmitEditing={handleLookup}
              returnKeyType="search"
            />
            {plate.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={Colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, (!plate.trim() || loading) && styles.searchBtnDisabled]}
            onPress={handleLookup}
            disabled={loading || !plate.trim()}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Ionicons name="search" size={20} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {result ? (
        <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
          <View style={styles.regCard}>
            <Text style={styles.regText}>{result.registrationNumber}</Text>
            <Text style={styles.makeText}>{result.yearOfManufacture} {result.make}</Text>
          </View>

          <ResultSection title="Overview">
            <ResultRow label="Colour" value={result.colour} />
            <ResultRow label="Fuel Type" value={result.fuelType} />
            <ResultRow label="Year" value={result.yearOfManufacture} />
            <ResultRow label="Engine" value={result.engineCapacity ? `${result.engineCapacity}cc` : undefined} />
          </ResultSection>

          <ResultSection title="Tax & MOT">
            <ResultRow label="MOT Status" value={result.motStatus} status={result.motStatus} />
            <ResultRow label="Tax Status" value={result.taxStatus} status={result.taxStatus} />
            <ResultRow
              label="Tax Due"
              value={result.taxDueDate
                ? new Date(result.taxDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                : undefined}
            />
          </ResultSection>

          <ResultSection title="Emissions">
            <ResultRow label="CO₂" value={result.co2Emissions ? `${result.co2Emissions} g/km` : undefined} />
            <ResultRow label="Euro Status" value={result.euroStatus} />
            <ResultRow label="Real Driving Emissions" value={result.realDrivingEmissions} />
          </ResultSection>

          <ResultSection title="Other">
            <ResultRow label="Type Approval" value={result.typeApproval} />
            <ResultRow label="Wheelplan" value={result.wheelplan} />
            <ResultRow label="Marked For Export" value={result.markedForExport ? 'Yes' : 'No'} />
            <ResultRow
              label="Last V5C Issued"
              value={result.dateOfLastV5CIssued
                ? new Date(result.dateOfLastV5CIssued).toLocaleDateString('en-GB')
                : undefined}
            />
          </ResultSection>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textDim} />
            <Text style={styles.disclaimerText}>Data from DVLA. Not saved to your vehicle list.</Text>
          </View>
        </ScrollView>
      ) : !loading && !error && (
        <View style={styles.placeholder}>
          <Ionicons name="car-sport-outline" size={64} color={Colors.textDim} />
          <Text style={styles.placeholderText}>Enter a registration plate to check any UK vehicle</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ResultRow({ label, value, status }: { label: string; value?: string | number | null; status?: string | null }) {
  if (value == null || value === '') return null;
  const isValid = status?.toLowerCase().includes('valid') || status?.toLowerCase().includes('taxed');
  const isInvalid = status?.toLowerCase().includes('not valid') || status?.toLowerCase().includes('untaxed') || status?.toLowerCase().includes('sorn');
  const color = isInvalid ? Colors.red : isValid ? Colors.green : Colors.text;

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, status ? { color } : {}]}>{String(value)}</Text>
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
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  plateWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingLeft: 14,
  },
  platePrefix: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginRight: 8,
  },
  plateInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    paddingVertical: 13,
    letterSpacing: 2,
  },
  clearBtn: { paddingRight: 12 },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.redDim,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: Colors.red, fontSize: 13, flex: 1 },
  results: { padding: 16, paddingTop: 4 },
  regCard: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  regText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    fontFamily: 'monospace',
    letterSpacing: 3,
  },
  makeText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { color: Colors.textMuted, fontSize: 13 },
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 16 },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 30,
  },
  disclaimerText: { color: Colors.textDim, fontSize: 12 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 40,
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
