import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getVehicleById, Vehicle } from '../../../services/db';
import { fetchMotHistory, MotHistoryVehicle, MotTest, MotDefect } from '../../../services/motHistory';
import { Colors } from '../../../constants/colors';

export default function MotHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<MotHistoryVehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      if (v) loadHistory(v.registration_number);
    }, [id])
  );

  const loadHistory = async (reg: string) => {
    setLoading(true);
    setError(null);
    setHistory(null);
    try {
      const data = await fetchMotHistory(reg);
      setHistory(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load MOT history.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const passCount = history?.motTests.filter(t => t.testResult === 'PASSED').length ?? 0;
  const failCount = history?.motTests.filter(t => t.testResult === 'FAILED').length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>MOT History</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => vehicle && loadHistory(vehicle.registration_number)}
          style={styles.refreshBtn}
          disabled={loading}
        >
          <Ionicons name="refresh" size={20} color={loading ? Colors.textDim : Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {loading && (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading MOT history...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={28} color={Colors.amber} />
            <Text style={styles.errorTitle}>Could not load history</Text>
            <Text style={styles.errorText}>{error}</Text>
            {error.includes('API key') && (
              <Text style={styles.errorHint}>
                Go to Settings → API Keys → MOT History API Key to add your DVSA key.
              </Text>
            )}
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => vehicle && loadHistory(vehicle.registration_number)}
            >
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {history && !loading && (
          <>
            {/* Summary strip */}
            <View style={styles.summaryStrip}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{history.motTests.length}</Text>
                <Text style={styles.summaryLabel}>Total tests</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: Colors.green }]}>{passCount}</Text>
                <Text style={styles.summaryLabel}>Passed</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: Colors.red }]}>{failCount}</Text>
                <Text style={styles.summaryLabel}>Failed</Text>
              </View>
              {history.motTests[0]?.odometerValue && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNum}>
                    {Number(history.motTests[0].odometerValue).toLocaleString()}
                  </Text>
                  <Text style={styles.summaryLabel}>Last mileage</Text>
                </View>
              )}
            </View>

            {/* Tests */}
            {history.motTests.map((test, idx) => (
              <MotTestCard
                key={test.motTestNumber ?? idx}
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
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── MOT Test Card ──────────────────────────────────────────────────────────────

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
            size={20}
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
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.textDim}
          />
        </View>
      </View>

      {/* Expiry date on passed tests */}
      {passed && test.expiryDate && (
        <Text style={styles.expiryLine}>
          Valid until: <Text style={styles.expiryDate}>{formatDate(test.expiryDate)}</Text>
        </Text>
      )}

      {/* Defect summary chips */}
      {test.defects.length > 0 && (
        <View style={styles.defectChips}>
          {failures.length > 0 && (
            <View style={[styles.defectChip, styles.defectChipFail]}>
              <Text style={styles.defectChipText}>{failures.length} failure{failures.length > 1 ? 's' : ''}</Text>
            </View>
          )}
          {advisories.length > 0 && (
            <View style={[styles.defectChip, styles.defectChipAdvisory]}>
              <Text style={styles.defectChipTextAmber}>{advisories.length} advisor{advisories.length > 1 ? 'ies' : 'y'}</Text>
            </View>
          )}
        </View>
      )}

      {/* Expanded defects */}
      {expanded && test.defects.length > 0 && (
        <View style={styles.defectsList}>
          {failures.map((d, i) => (
            <DefectRow key={`f${i}`} defect={d} />
          ))}
          {advisories.map((d, i) => (
            <DefectRow key={`a${i}`} defect={d} />
          ))}
        </View>
      )}

      {expanded && test.defects.length === 0 && (
        <Text style={styles.noDefects}>No advisories or failures recorded.</Text>
      )}
    </TouchableOpacity>
  );
}

function DefectRow({ defect }: { defect: MotDefect }) {
  const isAdvisory = defect.type === 'ADVISORY';
  const isDangerous = defect.dangerous;
  const color = isDangerous ? Colors.red : isAdvisory ? Colors.amber : Colors.red;
  const label = isDangerous ? 'DANGEROUS' : defect.type;

  return (
    <View style={styles.defectRow}>
      <View style={[styles.defectTypeDot, { backgroundColor: color }]} />
      <View style={styles.defectContent}>
        <Text style={[styles.defectType, { color }]}>{label}</Text>
        <Text style={styles.defectText}>{defect.text}</Text>
      </View>
    </View>
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
  refreshBtn: { padding: 6 },

  scroll: { padding: 16, paddingTop: 4, paddingBottom: 40 },

  centred: { alignItems: 'center', paddingTop: 80, gap: 14 },
  loadingText: { color: Colors.textMuted, fontSize: 14 },

  errorBox: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 24, alignItems: 'center', gap: 10,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  errorText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  errorHint: { fontSize: 12, color: Colors.textDim, textAlign: 'center', lineHeight: 17 },
  retryBtn: {
    marginTop: 8, backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  retryBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },

  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14,
    marginBottom: 14, gap: 8,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.textDim, marginTop: 2 },

  testCard: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderLeftWidth: 3,
  },
  testCardPass: { backgroundColor: Colors.surface, borderLeftColor: Colors.green },
  testCardFail: { backgroundColor: Colors.surface, borderLeftColor: Colors.red },

  testCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  testResultBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testResult: { fontSize: 14, fontWeight: '700' },
  latestBadge: {
    backgroundColor: Colors.primaryDark, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  latestBadgeText: { color: Colors.text, fontSize: 10, fontWeight: '700' },
  testRight: { alignItems: 'flex-end', gap: 2 },
  testDate: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  testOdo: { fontSize: 11, color: Colors.textDim },
  expiryLine: { fontSize: 12, color: Colors.textDim, marginTop: 6 },
  expiryDate: { color: Colors.textMuted, fontWeight: '500' },

  defectChips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  defectChip: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  defectChipFail: { backgroundColor: Colors.redDim },
  defectChipAdvisory: { backgroundColor: Colors.amberDim },
  defectChipText: { color: Colors.red, fontSize: 11, fontWeight: '600' },
  defectChipTextAmber: { color: Colors.amber, fontSize: 11, fontWeight: '600' },

  defectsList: {
    marginTop: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
  defectRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  defectTypeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  defectContent: { flex: 1 },
  defectType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  defectText: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },

  noDefects: { fontSize: 13, color: Colors.textDim, marginTop: 10, fontStyle: 'italic' },
});
