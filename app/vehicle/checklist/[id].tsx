import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getVehicleById, getChecklistItems, insertChecklistItem, deleteChecklistItem,
  getChecklistLogs, insertChecklistLog, ChecklistItem, ChecklistLog, Vehicle,
} from '../../../services/db';
import { Colors } from '../../../constants/colors';

// ── Default checklist items (hardcoded, always shown) ─────────────────────────

const DEFAULT_ITEMS: { id: string; label: string }[] = [
  { id: 'd1', label: 'Fuel level' },
  { id: 'd2', label: 'Engine oil level' },
  { id: 'd3', label: 'Tyre pressure & condition' },
  { id: 'd4', label: 'Lights (headlights, brake lights, indicators)' },
  { id: 'd5', label: 'Windscreen & washer fluid' },
  { id: 'd6', label: 'Mirrors adjusted' },
  { id: 'd7', label: 'Dashboard warning lights clear' },
  { id: 'd8', label: 'Seatbelts working' },
];

type CheckState = Record<string, boolean>;

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customItems, setCustomItems] = useState<ChecklistItem[]>([]);
  const [logs, setLogs] = useState<ChecklistLog[]>([]);
  const [checked, setChecked] = useState<CheckState>({});
  const [addingItem, setAddingItem] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [mileageInput, setMileageInput] = useState('');
  const [logModalVisible, setLogModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const v = getVehicleById(Number(id));
      setVehicle(v);
      setCustomItems(getChecklistItems(Number(id)));
      setLogs(getChecklistLogs(Number(id)));
      // Reset checks on each visit
      setChecked({});
    }, [id])
  );

  const allItems = [
    ...DEFAULT_ITEMS.map(d => ({ key: d.id, label: d.label, isCustom: false })),
    ...customItems.map(c => ({ key: `c${c.id}`, label: c.label, isCustom: true, dbId: c.id })),
  ];

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = checkedCount === allItems.length && allItems.length > 0;

  const toggle = (key: string) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddItem = () => {
    if (!newItemLabel.trim()) return;
    insertChecklistItem(Number(id), newItemLabel.trim(), customItems.length);
    setCustomItems(getChecklistItems(Number(id)));
    setNewItemLabel('');
    setAddingItem(false);
  };

  const handleDeleteCustom = (dbId: number) => {
    Alert.alert('Remove Item', 'Remove this item from your checklist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          deleteChecklistItem(dbId);
          setCustomItems(getChecklistItems(Number(id)));
          // Clean up checked state
          setChecked(prev => {
            const next = { ...prev };
            delete next[`c${dbId}`];
            return next;
          });
        },
      },
    ]);
  };

  const handleLogCheck = () => {
    if (!allChecked) {
      Alert.alert('Not complete', 'Please check all items before logging this check.');
      return;
    }
    setMileageInput('');
    setLogModalVisible(true);
  };

  const confirmLog = () => {
    const miles = mileageInput.trim() ? parseInt(mileageInput) : null;
    insertChecklistLog(Number(id), miles);
    setLogs(getChecklistLogs(Number(id)));
    setChecked({});
    setLogModalVisible(false);
    Alert.alert('Check logged ✓', 'Pre-drive check recorded successfully.');
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Pre-Drive Check</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              {
                width: allItems.length > 0 ? `${(checkedCount / allItems.length) * 100}%` : '0%' as any,
                backgroundColor: allChecked ? Colors.green : Colors.primary,
              },
            ]} />
          </View>
          <Text style={styles.progressText}>{checkedCount} / {allItems.length}</Text>
        </View>

        {/* Checklist */}
        <View style={styles.checklistCard}>
          {allItems.map((item, idx) => (
            <View key={item.key}>
              {idx > 0 && <View style={styles.itemDivider} />}
              <TouchableOpacity
                style={styles.checkItem}
                onPress={() => toggle(item.key)}
                activeOpacity={0.6}
              >
                <View style={[styles.checkbox, checked[item.key] && styles.checkboxChecked]}>
                  {checked[item.key] && (
                    <Ionicons name="checkmark" size={13} color={Colors.white} />
                  )}
                </View>
                <Text style={[styles.checkLabel, checked[item.key] && styles.checkLabelDone]}>
                  {item.label}
                </Text>
                {item.isCustom && (
                  <TouchableOpacity
                    onPress={() => handleDeleteCustom((item as any).dbId)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close" size={14} color={Colors.textDim} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          ))}

          {/* Add custom item */}
          {addingItem ? (
            <View style={styles.addItemRow}>
              <TextInput
                style={styles.addItemInput}
                placeholder="Custom item..."
                placeholderTextColor={Colors.textDim}
                value={newItemLabel}
                onChangeText={setNewItemLabel}
                autoFocus
                maxLength={60}
                onSubmitEditing={handleAddItem}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleAddItem} style={styles.addItemConfirm}>
                <Ionicons name="checkmark" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAddingItem(false); setNewItemLabel(''); }} style={styles.addItemCancel}>
                <Ionicons name="close" size={18} color={Colors.textDim} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addItemTrigger} onPress={() => setAddingItem(true)}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.addItemTriggerText}>Add custom item</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Log button */}
        <TouchableOpacity
          style={[styles.logBtn, !allChecked && styles.logBtnDisabled]}
          onPress={handleLogCheck}
          activeOpacity={allChecked ? 0.7 : 1}
        >
          <Ionicons name="checkmark-circle" size={20} color={allChecked ? Colors.white : Colors.textDim} />
          <Text style={[styles.logBtnText, !allChecked && styles.logBtnTextDisabled]}>
            {allChecked ? 'Log Check Complete' : `${allItems.length - checkedCount} item${allItems.length - checkedCount !== 1 ? 's' : ''} remaining`}
          </Text>
        </TouchableOpacity>

        {/* Check history */}
        {logs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Check History</Text>
            {logs.map(log => (
              <View key={log.id} style={styles.logCard}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.logDate}>{formatDateTime(log.completed_at)}</Text>
                  {log.mileage != null && (
                    <Text style={styles.logMileage}>{log.mileage.toLocaleString()} mi</Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Log modal */}
      <Modal visible={logModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Log Check Complete</Text>
            <Text style={styles.modalDesc}>All items checked. Optionally record your current mileage.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Odometer reading (optional)"
              placeholderTextColor={Colors.textDim}
              keyboardType="number-pad"
              value={mileageInput}
              onChangeText={v => setMileageInput(v.replace(/[^0-9]/g, ''))}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLogModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmLog}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  scroll: { padding: 16, paddingTop: 8, paddingBottom: 40 },

  progressContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, width: 36, textAlign: 'right' },

  checklistCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  itemDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },
  checkItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { flex: 1, fontSize: 14, color: Colors.text },
  checkLabelDone: { color: Colors.textDim, textDecorationLine: 'line-through' },
  removeBtn: { padding: 4 },

  addItemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addItemInput: {
    flex: 1, color: Colors.text, fontSize: 14,
    paddingVertical: 6,
  },
  addItemConfirm: { padding: 4 },
  addItemCancel: { padding: 4 },
  addItemTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addItemTriggerText: { fontSize: 13, color: Colors.textMuted },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, marginBottom: 24,
  },
  logBtnDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  logBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  logBtnTextDisabled: { color: Colors.textDim },

  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  logCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 10,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  logDate: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  logMileage: { fontSize: 12, color: Colors.textMuted },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 24, width: '100%', gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 4,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: { color: Colors.textMuted, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalConfirmText: { color: Colors.white, fontWeight: '700' },
});
