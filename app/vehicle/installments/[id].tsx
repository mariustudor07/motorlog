import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getVehicleById, getInstallments, insertInstallment, updateInstallment,
  deleteInstallment, Installment, InstallmentType, Vehicle,
} from '../../../services/db';
import {
  scheduleInstallmentReminder, cancelInstallmentReminder, getNextPaymentDate,
} from '../../../services/notifications';
import { Colors } from '../../../constants/colors';

const TYPE_OPTIONS: { value: InstallmentType; label: string; icon: string }[] = [
  { value: 'finance',   label: 'Finance',   icon: 'car-outline' },
  { value: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
  { value: 'tax',       label: 'Road Tax',  icon: 'receipt-outline' },
  { value: 'custom',    label: 'Other',     icon: 'ellipsis-horizontal-circle-outline' },
];

const TYPE_COLORS: Record<InstallmentType, string> = {
  finance:   Colors.primary,
  insurance: '#34C759',
  tax:       '#FF9500',
  custom:    Colors.textMuted,
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default function InstallmentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [items, setItems] = useState<Installment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Installment | null>(null);

  // Form state
  const [label, setLabel] = useState('');
  const [type, setType] = useState<InstallmentType>('finance');
  const [amount, setAmount] = useState('');
  const [paymentDay, setPaymentDay] = useState('1');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const v = getVehicleById(Number(id));
    setVehicle(v);
    const list = getInstallments(Number(id));
    setItems(list);

    // Reschedule any active installments whose notification may have expired
    if (v) {
      for (const item of list) {
        if (!item.active) continue;
        const notifId = await scheduleInstallmentReminder(item, v.registration_number, v.make);
        if (notifId) updateInstallment(item.id, { notification_id: notifId });
      }
    }
  }, [id]);

  useFocusEffect(load);

  const openAdd = () => {
    setEditing(null);
    setLabel('');
    setType('finance');
    setAmount('');
    setPaymentDay('1');
    setNotes('');
    setModalVisible(true);
  };

  const openEdit = (item: Installment) => {
    setEditing(item);
    setLabel(item.label);
    setType(item.type);
    setAmount(item.amount != null ? String(item.amount) : '');
    setPaymentDay(String(item.payment_day));
    setNotes(item.notes ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert('Missing label', 'Please enter a name for this payment.');
      return;
    }
    const day = parseInt(paymentDay);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Invalid day', 'Payment day must be between 1 and 31.');
      return;
    }
    const amt = amount.trim() ? parseFloat(amount) : null;
    if (amount.trim() && (isNaN(amt!) || amt! <= 0)) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (editing) {
      updateInstallment(editing.id, {
        label: label.trim(),
        type,
        amount: amt,
        payment_day: day,
        notes: notes.trim() || null,
      });
      const updated = getInstallments(Number(id)).find(i => i.id === editing.id)!;
      if (updated && vehicle) {
        const notifId = await scheduleInstallmentReminder(updated, vehicle.registration_number, vehicle.make);
        if (notifId) updateInstallment(updated.id, { notification_id: notifId });
      }
    } else {
      const newId = insertInstallment({
        vehicle_id: Number(id),
        label: label.trim(),
        type,
        amount: amt,
        payment_day: day,
        notes: notes.trim() || null,
        active: 1,
        notification_id: null,
      });
      const inserted = getInstallments(Number(id)).find(i => i.id === newId)!;
      if (inserted && vehicle) {
        const notifId = await scheduleInstallmentReminder(inserted, vehicle.registration_number, vehicle.make);
        if (notifId) updateInstallment(inserted.id, { notification_id: notifId });
      }
    }

    setItems(getInstallments(Number(id)));
    setModalVisible(false);
  };

  const handleDelete = (item: Installment) => {
    Alert.alert(
      'Delete Payment',
      `Remove "${item.label}" from your monthly payments?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await cancelInstallmentReminder(item.notification_id);
            deleteInstallment(item.id);
            setItems(getInstallments(Number(id)));
          },
        },
      ]
    );
  };

  const handleToggleActive = async (item: Installment) => {
    const newActive = item.active ? 0 : 1;
    if (!newActive) {
      await cancelInstallmentReminder(item.notification_id);
      updateInstallment(item.id, { active: 0, notification_id: null });
    } else {
      updateInstallment(item.id, { active: 1 });
      if (vehicle) {
        const refreshed = getInstallments(Number(id)).find(i => i.id === item.id)!;
        const notifId = await scheduleInstallmentReminder(refreshed, vehicle.registration_number, vehicle.make);
        if (notifId) updateInstallment(item.id, { notification_id: notifId });
      }
    }
    setItems(getInstallments(Number(id)));
  };

  const activeItems = items.filter(i => i.active);
  const totalMonthly = activeItems.reduce((sum, i) => sum + (i.amount ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Monthly Payments</Text>
          {vehicle && (
            <Text style={styles.subtitle}>{vehicle.registration_number} · {vehicle.make}</Text>
          )}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      {items.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>£{totalMonthly.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Monthly total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>£{(totalMonthly * 12).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Per year</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{activeItems.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={52} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No payments tracked</Text>
            <Text style={styles.emptyText}>
              Track monthly payments like car finance, insurance instalments, or road tax direct debits.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Add first payment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map(item => {
            const typeInfo = TYPE_OPTIONS.find(t => t.value === item.type)!;
            const nextDate = getNextPaymentDate(item.payment_day);
            const daysUntil = Math.ceil((nextDate.getTime() - Date.now()) / 86400000);
            const soon = daysUntil <= 3;

            return (
              <View key={item.id} style={[styles.card, !item.active && styles.cardInactive]}>
                <View style={styles.cardTop}>
                  <View style={[styles.typeIcon, { backgroundColor: TYPE_COLORS[item.type] + '22' }]}>
                    <Ionicons name={typeInfo.icon as any} size={18} color={TYPE_COLORS[item.type]} />
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={[styles.cardLabel, !item.active && styles.textDim]}>{item.label}</Text>
                    <Text style={styles.cardMeta}>{typeInfo.label} · {ordinal(item.payment_day)} each month</Text>
                    {item.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text> : null}
                  </View>
                  <View style={styles.cardRight}>
                    {item.amount != null && (
                      <Text style={[styles.cardAmount, !item.active && styles.textDim]}>
                        £{item.amount.toFixed(2)}
                      </Text>
                    )}
                    <Text style={[styles.cardNext, soon && item.active && styles.cardNextSoon]}>
                      {item.active
                        ? daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil}d`
                        : 'Paused'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <Switch
                    value={!!item.active}
                    onValueChange={() => handleToggleActive(item)}
                    trackColor={{ false: Colors.border, true: Colors.primary + '88' }}
                    thumbColor={item.active ? Colors.primary : Colors.textDim}
                  />
                  <Text style={styles.activeLabel}>{item.active ? 'Active' : 'Paused'}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={() => openEdit(item)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={Colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
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
              <Text style={styles.modalTitle}>{editing ? 'Edit Payment' : 'Add Payment'}</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Payment Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Car Finance, Monthly Insurance"
                placeholderTextColor={Colors.textDim}
                value={label}
                onChangeText={setLabel}
                autoFocus={!editing}
                maxLength={50}
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {TYPE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, type === opt.value && styles.chipActive]}
                    onPress={() => setType(opt.value)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={type === opt.value ? Colors.white : Colors.textMuted}
                    />
                    <Text style={[styles.chipText, type === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Monthly Amount (£)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 199.99"
                    placeholderTextColor={Colors.textDim}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ width: 90 }}>
                  <Text style={styles.fieldLabel}>Payment Day</Text>
                  <TextInput
                    style={[styles.input, { textAlign: 'center' }]}
                    placeholder="1–31"
                    placeholderTextColor={Colors.textDim}
                    keyboardType="number-pad"
                    value={paymentDay}
                    onChangeText={v => {
                      const n = v.replace(/[^0-9]/g, '');
                      if (n === '' || (parseInt(n) >= 1 && parseInt(n) <= 31)) setPaymentDay(n);
                    }}
                    maxLength={2}
                  />
                </View>
              </View>

              {paymentDay && !isNaN(parseInt(paymentDay)) && parseInt(paymentDay) >= 1 && parseInt(paymentDay) <= 31 && (
                <View style={styles.nextPaymentHint}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.nextPaymentHintText}>
                    Next: {getNextPaymentDate(parseInt(paymentDay)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {' '}· Reminder the day before at 9am
                  </Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>
                Notes <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Direct debit, 24-month agreement..."
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

  card: {
    backgroundColor: Colors.surface, borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardInactive: { opacity: 0.55 },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, gap: 12,
  },
  typeIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  cardMain: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  cardNotes: { fontSize: 11, color: Colors.textDim },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardNext: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  cardNextSoon: { color: '#FF9500' },
  textDim: { color: Colors.textDim },

  cardActions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 8,
  },
  activeLabel: { fontSize: 12, color: Colors.textDim },
  actionBtn: { padding: 4 },

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
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textMuted },
  chipTextActive: { color: Colors.white, fontWeight: '600' },

  nextPaymentHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
  },
  nextPaymentHintText: { fontSize: 12, color: Colors.textMuted, flex: 1 },
});
