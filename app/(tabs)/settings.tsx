import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadThresholds, saveThresholds, getDefaults, Thresholds } from '../../services/thresholds';
import { Colors } from '../../constants/colors';

export const MIKE_CONTEXT_KEY = 'mike_vehicle_context';

export default function SettingsScreen() {
  const [thresholds, setThresholds] = useState<Thresholds>(getDefaults());
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [mikeContext, setMikeContext] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const t = await loadThresholds();
        setThresholds(t);
        const stored = await AsyncStorage.getItem(MIKE_CONTEXT_KEY);
        // Default true — only false if explicitly set to 'false'
        setMikeContext(stored !== 'false');
      };
      load();
    }, [])
  );

  const handleMikeContextToggle = async (value: boolean) => {
    setMikeContext(value);
    await AsyncStorage.setItem(MIKE_CONTEXT_KEY, value ? 'true' : 'false');
  };

  // ── Threshold handlers ─────────────────────────────────────────────────────

  const adjustThreshold = (field: keyof Thresholds, delta: number) => {
    setThresholds(prev => {
      const next = { ...prev, [field]: Math.max(1, prev[field] + delta) };
      // Keep red < amber always
      if (field === 'redDays' && next.redDays >= next.amberDays) return prev;
      if (field === 'amberDays' && next.amberDays <= next.redDays) return prev;
      return next;
    });
    setThresholdSaved(false);
  };

  const handleThresholdInput = (field: keyof Thresholds, raw: string) => {
    const n = parseInt(raw);
    if (!isNaN(n) && n > 0) {
      setThresholds(prev => ({ ...prev, [field]: n }));
      setThresholdSaved(false);
    }
  };

  const handleSaveThresholds = async () => {
    if (thresholds.redDays >= thresholds.amberDays) {
      Alert.alert('Invalid', 'Red threshold must be fewer days than amber.');
      return;
    }
    await saveThresholds(thresholds);
    setThresholdSaved(true);
  };

  const handleResetThresholds = () => {
    setThresholds(getDefaults());
    setThresholdSaved(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Notification thresholds</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Reminder Thresholds ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Reminder Thresholds</Text>
        <Text style={styles.sectionNote}>
          Controls when vehicle cards change colour and when you receive notifications.
        </Text>

        <View style={styles.thresholdCard}>
          {/* Visual preview bar */}
          <View style={styles.previewBar}>
            <View style={[styles.previewSegment, { backgroundColor: Colors.redDim, flex: thresholds.redDays }]}>
              <Text style={[styles.previewLabel, { color: Colors.red }]}>🔴 Red</Text>
            </View>
            <View style={[styles.previewSegment, { backgroundColor: Colors.amberDim, flex: thresholds.amberDays - thresholds.redDays }]}>
              <Text style={[styles.previewLabel, { color: Colors.amber }]}>🟡 Amber</Text>
            </View>
            <View style={[styles.previewSegment, { backgroundColor: Colors.greenDim, flex: 2 }]}>
              <Text style={[styles.previewLabel, { color: Colors.green }]}>🟢 Green</Text>
            </View>
          </View>

          {/* Amber threshold */}
          <ThresholdRow
            label="🟡  Amber warning"
            description="Show amber when fewer than this many days remain"
            value={thresholds.amberDays}
            onDecrease={() => adjustThreshold('amberDays', -5)}
            onIncrease={() => adjustThreshold('amberDays', 5)}
            onChangeText={v => handleThresholdInput('amberDays', v)}
          />

          <View style={styles.divider} />

          {/* Red threshold */}
          <ThresholdRow
            label="🔴  Red warning"
            description="Show red when fewer than this many days remain"
            value={thresholds.redDays}
            onDecrease={() => adjustThreshold('redDays', -5)}
            onIncrease={() => adjustThreshold('redDays', 5)}
            onChangeText={v => handleThresholdInput('redDays', v)}
          />

          <View style={styles.thresholdBtnRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetThresholds}>
              <Text style={styles.resetBtnText}>Reset defaults</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveThresholdBtn, thresholdSaved && styles.saveThresholdBtnSaved]}
              onPress={handleSaveThresholds}
            >
              {thresholdSaved
                ? <><Ionicons name="checkmark" size={14} color={Colors.green} /><Text style={styles.saveThresholdBtnSavedText}>Saved</Text></>
                : <Text style={styles.saveThresholdBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Ask Mike ─────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Ask Mike</Text>
        <Text style={styles.sectionNote}>
          Controls what Mike knows when you chat with him.
        </Text>
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <Ionicons name="car-outline" size={18} color={Colors.primary} style={{ marginTop: 1 }} />
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Share my saved vehicles</Text>
              <Text style={styles.toggleDesc}>
                Mike will know your reg, make, fuel type and expiry dates — so his advice is specific to your car. Your vehicle details are sent to Google when you chat.
              </Text>
            </View>
          </View>
          <Switch
            value={mikeContext}
            onValueChange={handleMikeContextToggle}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutText}>Motorlog v1.0{'\n'}Vehicle data from DVLA VES API{'\n'}MOT history from DVSA MOT History API{'\n'}AI powered by Google Gemini</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Threshold row component ───────────────────────────────────────────────────

function ThresholdRow({
  label, description, value, onDecrease, onIncrease, onChangeText,
}: {
  label: string;
  description: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.thresholdRow}>
      <View style={styles.thresholdLeft}>
        <Text style={styles.thresholdLabel}>{label}</Text>
        <Text style={styles.thresholdDesc}>{description}</Text>
      </View>
      <View style={styles.thresholdControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDecrease}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.thresholdInput}
          value={String(value)}
          onChangeText={onChangeText}
          keyboardType="numeric"
          maxLength={3}
          selectTextOnFocus
        />
        <Text style={styles.daysUnit}>days</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onIncrease}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  sectionNote: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 14 },

  // Threshold card
  thresholdCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 20 },
  previewBar: {
    flexDirection: 'row', borderRadius: 8, overflow: 'hidden', height: 36, marginBottom: 18,
  },
  previewSegment: { justifyContent: 'center', alignItems: 'center', minWidth: 40 },
  previewLabel: { fontSize: 10, fontWeight: '700' },
  thresholdRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 10,
  },
  thresholdLeft: { flex: 1 },
  thresholdLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  thresholdDesc: { fontSize: 12, color: Colors.textDim, marginTop: 2 },
  thresholdControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  stepBtnText: { color: Colors.text, fontSize: 18, fontWeight: '600', lineHeight: 22 },
  thresholdInput: {
    width: 46, textAlign: 'center', color: Colors.text,
    fontSize: 16, fontWeight: '700',
    backgroundColor: Colors.surfaceAlt, borderRadius: 8,
    paddingVertical: 6, borderWidth: 1, borderColor: Colors.border,
  },
  daysUnit: { fontSize: 12, color: Colors.textDim },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  thresholdBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  resetBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
  },
  resetBtnText: { color: Colors.textMuted, fontSize: 13 },
  saveThresholdBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
  },
  saveThresholdBtnSaved: { backgroundColor: Colors.greenDim },
  saveThresholdBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
  saveThresholdBtnSavedText: { color: Colors.green, fontWeight: '600', fontSize: 13 },

  toggleCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    marginBottom: 20, flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 12,
  },
  toggleLeft: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  toggleDesc: { fontSize: 12, color: Colors.textDim, lineHeight: 17 },

  aboutCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginTop: 8 },
  aboutTitle: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 },
  aboutText: { fontSize: 13, color: Colors.textDim, lineHeight: 20 },
});
