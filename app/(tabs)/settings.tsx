import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getApiKey, setApiKey, clearApiKey, Keys } from '../../services/storage';
import { loadThresholds, saveThresholds, getDefaults, Thresholds } from '../../services/thresholds';
import { Colors } from '../../constants/colors';

type KeyEntry = {
  key: string;
  label: string;
  placeholder: string;
  helpText: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const API_KEYS: KeyEntry[] = [
  {
    key: Keys.DVLA_API_KEY,
    label: 'DVLA API Key',
    placeholder: 'Paste your DVLA VES API key',
    helpText: 'Get a free key from the DVLA Developer Portal',
    icon: 'car-outline',
  },
  {
    key: Keys.GEMINI_API_KEY,
    label: 'Gemini API Key',
    placeholder: 'Paste your Google AI Studio key',
    helpText: 'Get a free key from Google AI Studio',
    icon: 'sparkles-outline',
  },
];

export default function SettingsScreen() {
  // API keys state
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Threshold state
  const [thresholds, setThresholds] = useState<Thresholds>(getDefaults());
  const [thresholdSaved, setThresholdSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        // Load API keys
        const loaded: Record<string, string> = {};
        const savedStatus: Record<string, boolean> = {};
        for (const entry of API_KEYS) {
          const val = await getApiKey(entry.key);
          loaded[entry.key] = val ?? '';
          savedStatus[entry.key] = !!val;
        }
        setValues(loaded);
        setSaved(savedStatus);
        // Load thresholds
        const t = await loadThresholds();
        setThresholds(t);
      };
      load();
    }, [])
  );

  // ── API key handlers ───────────────────────────────────────────────────────

  const handleSaveKey = async (entry: KeyEntry) => {
    const val = values[entry.key]?.trim();
    if (!val) { Alert.alert('Empty Key', 'Please paste your API key before saving.'); return; }
    setSaving(s => ({ ...s, [entry.key]: true }));
    try {
      await setApiKey(entry.key, val);
      setSaved(s => ({ ...s, [entry.key]: true }));
    } catch {
      Alert.alert('Error', 'Failed to save API key. Please try again.');
    } finally {
      setSaving(s => ({ ...s, [entry.key]: false }));
    }
  };

  const handleClearKey = (entry: KeyEntry) => {
    Alert.alert(
      `Remove ${entry.label}`,
      'This will remove the key. Features using it will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await clearApiKey(entry.key);
            setValues(v => ({ ...v, [entry.key]: '' }));
            setSaved(s => ({ ...s, [entry.key]: false }));
          },
        },
      ]
    );
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
        <Text style={styles.subtitle}>API keys & notification thresholds</Text>
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

        {/* ── API Keys ─────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>API Keys</Text>
        <Text style={styles.sectionNote}>
          Keys are stored securely on your device. Never sent anywhere except the respective APIs.
        </Text>

        {API_KEYS.map(entry => (
          <View key={entry.key} style={styles.keyCard}>
            <View style={styles.keyHeader}>
              <Ionicons name={entry.icon} size={18} color={Colors.primary} />
              <Text style={styles.keyLabel}>{entry.label}</Text>
              {saved[entry.key] && (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
                  <Text style={styles.savedText}>Saved</Text>
                </View>
              )}
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder={entry.placeholder}
                placeholderTextColor={Colors.textDim}
                value={values[entry.key] ?? ''}
                onChangeText={v => setValues(prev => ({ ...prev, [entry.key]: v }))}
                secureTextEntry={!visible[entry.key]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setVisible(v => ({ ...v, [entry.key]: !v[entry.key] }))}
                style={styles.eyeBtn}
              >
                <Ionicons name={visible[entry.key] ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textDim} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>{entry.helpText}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.saveBtn, saving[entry.key] && styles.saveBtnDisabled]}
                onPress={() => handleSaveKey(entry)}
                disabled={saving[entry.key]}
              >
                {saving[entry.key]
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
              {saved[entry.key] && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => handleClearKey(entry)}>
                  <Text style={styles.clearBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutText}>Motorlog v1.0{'\n'}Vehicle data from DVLA VES API{'\n'}AI powered by Google Gemini</Text>
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

  // API key card
  keyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 14 },
  keyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  keyLabel: { fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1 },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.greenDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  savedText: { color: Colors.green, fontSize: 12, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  input: {
    flex: 1, color: Colors.text, fontSize: 13,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'monospace',
  },
  eyeBtn: { paddingRight: 14 },
  helpText: { fontSize: 12, color: Colors.textDim, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 10 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', minWidth: 80,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  clearBtn: {
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.redDim,
  },
  clearBtnText: { color: Colors.red, fontWeight: '600', fontSize: 14 },
  aboutCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginTop: 8 },
  aboutTitle: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 },
  aboutText: { fontSize: 13, color: Colors.textDim, lineHeight: 20 },
});
