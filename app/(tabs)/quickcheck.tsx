import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { lookupVehicle, DvlaVehicle } from '../../services/dvla';
import { fetchMotHistory, MotHistoryVehicle, MotTest, MotDefect } from '../../services/motHistory';
import { Colors } from '../../constants/colors';

export default function QuickCheckScreen() {
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DvlaVehicle | null>(null);

  // MOT history state
  const [motHistory, setMotHistory] = useState<MotHistoryVehicle | null>(null);
  const [motLoading, setMotLoading] = useState(false);
  const [motError, setMotError] = useState('');
  const [motExpanded, setMotExpanded] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setMotHistory(null);
    setMotError('');
    setMotExpanded(false);
    try {
      const data = await lookupVehicle(plate);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMotHistory = async () => {
    if (!plate.trim()) return;
    setMotLoading(true);
    setMotError('');
    setMotHistory(null);
    setMotExpanded(true);
    try {
      const data = await fetchMotHistory(plate);
      setMotHistory(data);
    } catch (e: any) {
      setMotError(e.message);
    } finally {
      setMotLoading(false);
    }
  };

  const handleClear = () => {
    setPlate('');
    setResult(null);
    setError('');
    setMotHistory(null);
    setMotError('');
    setMotExpanded(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
              maxLength={10}
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

          {/* ── MOT History Section ────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.motHistoryBtn}
            onPress={motExpanded ? () => setMotExpanded(false) : handleLoadMotHistory}
            disabled={motLoading}
          >
            <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            <Text style={styles.motHistoryBtnText}>
              {motExpanded ? 'Hide MOT History' : 'View Full MOT History'}
            </Text>
            {motLoading
              ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 'auto' }} />
              : <Ionicons
                  name={motExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.textDim}
                  style={{ marginLeft: 'auto' }}
                />
            }
          </TouchableOpacity>

          {motExpanded && !!motError && (
            <View style={styles.motErrorBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.amber} />
              <Text style={styles.motErrorText}>{motError}</Text>
            </View>
          )}

          {motExpanded && motHistory && (
            <View style={styles.motHistorySection}>
              {/* Summary */}
              <View style={styles.motSummaryStrip}>
                <View style={styles.motSummaryItem}>
                  <Text style={styles.motSummaryNum}>{motHistory.motTests.length}</Text>
                  <Text style={styles.motSummaryLabel}>Tests</Text>
                </View>
                <View style={styles.motSummaryItem}>
                  <Text style={[styles.motSummaryNum, { color: Colors.green }]}>
                    {motHistory.motTests.filter(t => t.testResult === 'PASSED').length}
                  </Text>
                  <Text style={styles.motSummaryLabel}>Passed</Text>
                </View>
                <View style={styles.motSummaryItem}>
                  <Text style={[styles.motSummaryNum, { color: Colors.red }]}>
                    {motHistory.motTests.filter(t => t.testResult === 'FAILED').length}
                  </Text>
                  <Text style={styles.motSummaryLabel}>Failed</Text>
                </View>
                {motHistory.motTests[0]?.odometerValue && (
                  <View style={styles.motSummaryItem}>
                    <Text style={styles.motSummaryNum}>
                      {Number(motHistory.motTests[0].odometerValue).toLocaleString()}
                    </Text>
                    <Text style={styles.motSummaryLabel}>Last mi</Text>
                  </View>
                )}
              </View>

              {/* Test cards */}
              {motHistory.motTests.map((test, idx) => (
                <MotTestCard
                  key={test.motTestNumber ?? String(idx)}
                  test={test}
                  isFirst={idx === 0}
                  expanded={expandedTest === (test.motTestNumber ?? String(idx))}
                  onToggle={() =>
                    setExpandedTest(prev =>
                      prev === (test.motTestNumber ?? String(idx)) ? null : (test.motTestNumber ?? String(idx))
                    )
                  }
                  formatDate={formatDate}
                />
              ))}
            </View>
          )}

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textDim} />
            <Text style={styles.disclaimerText}>Data from DVLA / DVSA. Not saved to your vehicle list.</Text>
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

// ── MOT Test Card (inline) ────────────────────────────────────────────────────

function MotTestCard({
  test, isFirst, expanded, onToggle, formatDate,
}: {
  test: MotTest;
  isFirst: boolean;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (d: string) => string;
}) {
  const passed = test.testResult === 'PASSED';
  const advisories = test.defects.filter(d => d.type === 'ADVISORY');
  const failures = test.defects.filter(d => d.type !== 'ADVISORY');

  return (
    <TouchableOpacity
      style={[styles.testCard, passed ? styles.testCardPass : styles.testCardFail]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.testCardHeader}>
        <View style={styles.testResultBadge}>
          <Ionicons
            name={passed ? 'checkmark-circle' : 'close-circle'}
            size={18}
            color={passed ? Colors.green : Colors.red}
          />
          <Text style={[styles.testResult, { color: passed ? Colors.green : Colors.red }]}>
            {test.testResult}
          </Text>
          {isFirst && <View style={styles.latestBadge}><Text style={styles.latestBadgeText}>Latest</Text></View>}
        </View>
        <View style={styles.testRight}>
          <Text style={styles.testDate}>{formatDate(test.completedDate)}</Text>
          {test.odometerValue && (
            <Text style={styles.testOdo}>
              {Number(test.odometerValue).toLocaleString()} {test.odometerUnit ?? 'mi'}
            </Text>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textDim} />
        </View>
      </View>

      {test.defects.length > 0 && (
        <View style={styles.defectChips}>
          {failures.length > 0 && (
            <View style={[styles.defectChip, styles.defectChipFail]}>
              <Text style={styles.defectChipTextRed}>{failures.length} failure{failures.length > 1 ? 's' : ''}</Text>
            </View>
          )}
          {advisories.length > 0 && (
            <View style={[styles.defectChip, styles.defectChipAdvisory]}>
              <Text style={styles.defectChipTextAmber}>{advisories.length} advisor{advisories.length > 1 ? 'ies' : 'y'}</Text>
            </View>
          )}
        </View>
      )}

      {expanded && (
        <View style={styles.defectsList}>
          {test.defects.length === 0
            ? <Text style={styles.noDefects}>No advisories or failures.</Text>
            : [...failures, ...advisories].map((d, i) => <DefectRow key={i} defect={d} />)
          }
        </View>
      )}
    </TouchableOpacity>
  );
}

function DefectRow({ defect }: { defect: MotDefect }) {
  const isAdvisory = defect.type === 'ADVISORY';
  const color = defect.dangerous ? Colors.red : isAdvisory ? Colors.amber : Colors.red;
  const label = defect.dangerous ? 'DANGEROUS' : defect.type;
  return (
    <View style={styles.defectRow}>
      <View style={[styles.defectDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.defectType, { color }]}>{label}</Text>
        <Text style={styles.defectText}>{defect.text}</Text>
      </View>
    </View>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  searchSection: { paddingHorizontal: 16, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  plateWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingLeft: 14,
  },
  platePrefix: { color: Colors.primary, fontWeight: '700', fontSize: 14, marginRight: 8 },
  plateInput: {
    flex: 1, color: Colors.text, fontSize: 18, fontWeight: '700',
    fontFamily: 'monospace', paddingVertical: 13, letterSpacing: 2,
  },
  clearBtn: { paddingRight: 12 },
  searchBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, width: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.redDim, borderRadius: 10, padding: 12,
  },
  errorText: { color: Colors.red, fontSize: 13, flex: 1 },
  results: { padding: 16, paddingTop: 4 },
  regCard: {
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 20, alignItems: 'center', marginBottom: 16,
  },
  regText: {
    fontSize: 28, fontWeight: '900', color: Colors.white,
    fontFamily: 'monospace', letterSpacing: 3,
  },
  makeText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { color: Colors.textMuted, fontSize: 13 },
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 16 },

  // MOT History button
  motHistoryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  motHistoryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },

  motErrorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.amberDim, borderRadius: 10, padding: 12, marginBottom: 12,
  },
  motErrorText: { color: Colors.amber, fontSize: 13, flex: 1, lineHeight: 18 },

  motHistorySection: { marginBottom: 8 },
  motSummaryStrip: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 12, marginBottom: 10, gap: 6,
  },
  motSummaryItem: { flex: 1, alignItems: 'center' },
  motSummaryNum: { fontSize: 14, fontWeight: '700', color: Colors.text },
  motSummaryLabel: { fontSize: 10, color: Colors.textDim, marginTop: 2 },

  // Test cards
  testCard: {
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderLeftWidth: 3, backgroundColor: Colors.surface,
  },
  testCardPass: { borderLeftColor: Colors.green },
  testCardFail: { borderLeftColor: Colors.red },
  testCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  testResultBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testResult: { fontSize: 13, fontWeight: '700' },
  latestBadge: {
    backgroundColor: Colors.primaryDark, borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  latestBadgeText: { color: Colors.text, fontSize: 9, fontWeight: '700' },
  testRight: { alignItems: 'flex-end', gap: 2 },
  testDate: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  testOdo: { fontSize: 10, color: Colors.textDim },

  defectChips: { flexDirection: 'row', gap: 6, marginTop: 8 },
  defectChip: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  defectChipFail: { backgroundColor: Colors.redDim },
  defectChipAdvisory: { backgroundColor: Colors.amberDim },
  defectChipTextRed: { color: Colors.red, fontSize: 10, fontWeight: '600' },
  defectChipTextAmber: { color: Colors.amber, fontSize: 10, fontWeight: '600' },

  defectsList: {
    marginTop: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10,
  },
  defectRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  defectDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  defectType: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 1 },
  defectText: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  noDefects: { fontSize: 12, color: Colors.textDim, fontStyle: 'italic' },

  disclaimer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', marginTop: 4, marginBottom: 30,
  },
  disclaimerText: { color: Colors.textDim, fontSize: 12 },
  placeholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 40,
  },
  placeholderText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
