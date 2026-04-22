import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { lookupVehicle, DvlaVehicle } from '../services/dvla';
import { insertVehicle } from '../services/db';
import { scheduleRemindersForVehicle } from '../services/notifications';
import { Colors } from '../constants/colors';

export type AddVehicleSheetRef = {
  open: () => void;
  close: () => void;
};

type Props = {
  onVehicleAdded: () => void;
};

type DateField = 'mot_expiry_date' | 'tax_due_date' | 'insurance_expiry_date';

type ManualForm = {
  registration_number: string;
  make: string;
  colour: string;
  fuel_type: string;
  engine_capacity: string;
  year_of_manufacture: string;
};

const EMPTY_MANUAL: ManualForm = {
  registration_number: '',
  make: '',
  colour: '',
  fuel_type: '',
  engine_capacity: '',
  year_of_manufacture: '',
};

const SNAP_POINTS = ['90%'];

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'OTHER'];

export const AddVehicleSheet = forwardRef<AddVehicleSheetRef, Props>(({ onVehicleAdded }, ref) => {
  const sheetRef = useRef<BottomSheet>(null);

  // Lookup state
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dvlaData, setDvlaData] = useState<DvlaVehicle | null>(null);

  // Manual mode
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);

  // Dates (shared between both flows)
  const [motExpiry, setMotExpiry] = useState<Date | null>(null);
  const [taxDue, setTaxDue] = useState<Date | null>(null);
  const [insuranceExpiry, setInsuranceExpiry] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<DateField | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.expand(),
    close: () => sheetRef.current?.close(),
  }));

  const reset = () => {
    setPlate('');
    setError('');
    setDvlaData(null);
    setManualMode(false);
    setManualForm(EMPTY_MANUAL);
    setMotExpiry(null);
    setTaxDue(null);
    setInsuranceExpiry(null);
    setShowPicker(null);
    setLoading(false);
  };

  const handleLookup = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');
    setDvlaData(null);
    try {
      const data = await lookupVehicle(plate);
      setDvlaData(data);
      if (data.taxDueDate) setTaxDue(new Date(data.taxDueDate));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchToManual = () => {
    setManualMode(true);
    setError('');
    // Pre-fill reg if already typed
    if (plate.trim()) {
      setManualForm(f => ({ ...f, registration_number: plate.replace(/\s+/g, '').toUpperCase() }));
    }
  };

  const setField = (field: keyof ManualForm, value: string) => {
    setManualForm(f => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      let reg: string, make: string, colour: string, fuelType: string;
      let engineCapacity: number | null = null;
      let yearOfManufacture: number | null = null;
      let motStatus: string | null = null;
      let taxStatus: string | null = null;
      let rawJson: string | null = null;

      if (manualMode) {
        if (!manualForm.registration_number.trim()) throw new Error('Registration number is required.');
        if (!manualForm.make.trim()) throw new Error('Make is required.');
        reg = manualForm.registration_number.replace(/\s+/g, '').toUpperCase();
        make = manualForm.make.trim();
        colour = manualForm.colour.trim() || 'Unknown';
        fuelType = manualForm.fuel_type.trim() || 'Unknown';
        engineCapacity = manualForm.engine_capacity ? parseInt(manualForm.engine_capacity) || null : null;
        yearOfManufacture = manualForm.year_of_manufacture ? parseInt(manualForm.year_of_manufacture) || null : null;
      } else {
        if (!dvlaData) return;
        reg = dvlaData.registrationNumber;
        make = dvlaData.make ?? 'Unknown';
        colour = dvlaData.colour ?? 'Unknown';
        fuelType = dvlaData.fuelType ?? 'Unknown';
        engineCapacity = dvlaData.engineCapacity ?? null;
        yearOfManufacture = dvlaData.yearOfManufacture ?? null;
        motStatus = dvlaData.motStatus ?? null;
        taxStatus = dvlaData.taxStatus ?? null;
        rawJson = JSON.stringify(dvlaData);
      }

      const id = insertVehicle({
        registration_number: reg,
        make,
        colour,
        fuel_type: fuelType,
        engine_capacity: engineCapacity,
        year_of_manufacture: yearOfManufacture,
        co2_emissions: dvlaData?.co2Emissions ?? null,
        euro_status: dvlaData?.euroStatus ?? null,
        mot_status: motStatus,
        mot_expiry_date: motExpiry ? motExpiry.toISOString().split('T')[0] : null,
        tax_status: taxStatus,
        tax_due_date: taxDue ? taxDue.toISOString().split('T')[0] : null,
        insurance_expiry_date: insuranceExpiry ? insuranceExpiry.toISOString().split('T')[0] : null,
        raw_dvla_json: rawJson,
      });

      if (motExpiry)
        await scheduleRemindersForVehicle({ vehicleId: id, registration: reg, make, type: 'mot', dueDate: motExpiry.toISOString().split('T')[0] });
      if (taxDue)
        await scheduleRemindersForVehicle({ vehicleId: id, registration: reg, make, type: 'tax', dueDate: taxDue.toISOString().split('T')[0] });
      if (insuranceExpiry)
        await scheduleRemindersForVehicle({ vehicleId: id, registration: reg, make, type: 'insurance', dueDate: insuranceExpiry.toISOString().split('T')[0] });

      reset();
      sheetRef.current?.close();
      onVehicleAdded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Tap to set';

  const dateValue = (field: DateField) => {
    if (field === 'mot_expiry_date') return motExpiry;
    if (field === 'tax_due_date') return taxDue;
    return insuranceExpiry;
  };

  const setDateValue = (field: DateField, date: Date) => {
    if (field === 'mot_expiry_date') setMotExpiry(date);
    else if (field === 'tax_due_date') setTaxDue(date);
    else setInsuranceExpiry(date);
  };

  const canSave = manualMode
    ? manualForm.registration_number.trim().length > 0 && manualForm.make.trim().length > 0
    : dvlaData !== null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={reset}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: Colors.border }}
      backgroundStyle={{ backgroundColor: Colors.surface }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BottomSheetScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

            {/* Header */}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{manualMode ? 'Add Manually' : 'Add Vehicle'}</Text>
              {manualMode && (
                <TouchableOpacity onPress={() => { setManualMode(false); setError(''); }} style={styles.backLink}>
                  <Ionicons name="arrow-back" size={16} color={Colors.primary} />
                  <Text style={styles.backLinkText}>DVLA Lookup</Text>
                </TouchableOpacity>
              )}
            </View>

            {!manualMode && (
              <>
                <Text style={styles.subtitle}>Enter your registration plate to look up vehicle details</Text>

                <View style={styles.plateRow}>
                  <View style={styles.plateInputWrap}>
                    <Text style={styles.platePrefix}>GB</Text>
                    <TextInput
                      style={styles.plateInput}
                      placeholder="AB12 CDE"
                      placeholderTextColor={Colors.textDim}
                      value={plate}
                      onChangeText={t => setPlate(t.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={8}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.lookupBtn, (loading || !plate.trim()) && styles.lookupBtnDisabled]}
                    onPress={handleLookup}
                    disabled={loading || !plate.trim()}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.lookupBtnText}>Look up</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Error + manual fallback */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!manualMode && (error || (!dvlaData && !loading)) && (
              <TouchableOpacity style={styles.manualBtn} onPress={switchToManual}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={styles.manualBtnText}>Add details manually instead</Text>
              </TouchableOpacity>
            )}

            {/* DVLA success banner */}
            {!manualMode && dvlaData && (
              <View style={styles.vehicleInfo}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
                <Text style={styles.vehicleInfoText}>
                  {dvlaData.yearOfManufacture} {dvlaData.make} · {dvlaData.colour} · {dvlaData.fuelType}
                </Text>
              </View>
            )}

            {/* Manual form */}
            {manualMode && (
              <View style={styles.manualForm}>
                <ManualField
                  label="Registration Number *"
                  value={manualForm.registration_number}
                  onChangeText={v => setField('registration_number', v.toUpperCase().replace(/\s+/g, ''))}
                  placeholder="AB12CDE"
                  mono
                  maxLength={8}
                  autoCapitalize="characters"
                />
                <ManualField
                  label="Make *"
                  value={manualForm.make}
                  onChangeText={v => setField('make', v)}
                  placeholder="e.g. FORD"
                  autoCapitalize="characters"
                />
                <ManualField
                  label="Colour"
                  value={manualForm.colour}
                  onChangeText={v => setField('colour', v)}
                  placeholder="e.g. BLACK"
                  autoCapitalize="characters"
                />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Fuel Type</Text>
                  <View style={styles.fuelRow}>
                    {FUEL_TYPES.map(f => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.fuelChip, manualForm.fuel_type === f && styles.fuelChipActive]}
                        onPress={() => setField('fuel_type', f)}
                      >
                        <Text style={[styles.fuelChipText, manualForm.fuel_type === f && styles.fuelChipTextActive]}>
                          {f}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.rowTwo}>
                  <View style={{ flex: 1 }}>
                    <ManualField
                      label="Year"
                      value={manualForm.year_of_manufacture}
                      onChangeText={v => setField('year_of_manufacture', v)}
                      placeholder="2018"
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ManualField
                      label="Engine (cc)"
                      value={manualForm.engine_capacity}
                      onChangeText={v => setField('engine_capacity', v)}
                      placeholder="1600"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Date pickers — shown once we have data (either flow) */}
            {(dvlaData || manualMode) && (
              <View style={styles.datesSection}>
                <Text style={styles.sectionTitle}>Expiry Dates</Text>

                <DateRow
                  label="MOT Expiry"
                  icon="shield-checkmark-outline"
                  value={formatDate(motExpiry)}
                  onPress={() => setShowPicker('mot_expiry_date')}
                />
                <DateRow
                  label="Road Tax Due"
                  icon="card-outline"
                  value={formatDate(taxDue)}
                  onPress={() => setShowPicker('tax_due_date')}
                  note={(!manualMode && dvlaData?.taxDueDate) ? 'Pre-filled from DVLA' : undefined}
                />
                <DateRow
                  label="Insurance Expiry"
                  icon="umbrella-outline"
                  value={formatDate(insuranceExpiry)}
                  onPress={() => setShowPicker('insurance_expiry_date')}
                />

                {showPicker && (
                  <DateTimePicker
                    value={dateValue(showPicker) ?? new Date()}
                    mode="date"
                    display="spinner"
                    themeVariant="dark"
                    onChange={(_, date) => {
                      if (date) setDateValue(showPicker, date);
                      setShowPicker(null);
                    }}
                  />
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, (!canSave || loading) && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!canSave || loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Vehicle</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
});

// ── Small reusable field ──────────────────────────────────────────────────────

function ManualField({
  label, value, onChangeText, placeholder, mono, maxLength, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, mono && styles.fieldInputMono]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDim}
        maxLength={maxLength}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
    </View>
  );
}

function DateRow({
  label, icon, value, onPress, note,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  onPress: () => void;
  note?: string;
}) {
  return (
    <TouchableOpacity style={styles.dateRow} onPress={onPress}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <View style={styles.dateRowContent}>
        <Text style={styles.dateRowLabel}>{label}</Text>
        {note && <Text style={styles.dateRowNote}>{note}</Text>}
      </View>
      <Text style={styles.dateRowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLinkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },

  plateRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  plateInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, paddingLeft: 12,
  },
  platePrefix: { color: Colors.primary, fontWeight: '700', fontSize: 14, marginRight: 8 },
  plateInput: {
    flex: 1, color: Colors.text, fontSize: 18, fontWeight: '700',
    fontFamily: 'monospace', paddingVertical: 12, letterSpacing: 2,
  },
  lookupBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center',
  },
  lookupBtnDisabled: { opacity: 0.5 },
  lookupBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.redDim, borderRadius: 10, padding: 12, marginBottom: 10,
  },
  errorText: { color: Colors.red, fontSize: 13, flex: 1 },

  manualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 10,
    padding: 12, marginBottom: 14, justifyContent: 'center',
  },
  manualBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  vehicleInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.greenDim, borderRadius: 10, padding: 12, marginBottom: 20,
  },
  vehicleInfoText: { color: Colors.green, fontWeight: '600', fontSize: 14 },

  manualForm: { marginBottom: 8 },

  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, color: Colors.text, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  fieldInputMono: { fontFamily: 'monospace', letterSpacing: 2, fontWeight: '700', fontSize: 17 },

  fuelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fuelChip: {
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.surfaceAlt,
  },
  fuelChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fuelChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  fuelChipTextActive: { color: Colors.white },

  rowTwo: { flexDirection: 'row', gap: 10 },

  datesSection: { marginTop: 4 },
  sectionTitle: {
    fontSize: 14, fontWeight: '600', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 8,
  },
  dateRowContent: { flex: 1 },
  dateRowLabel: { color: Colors.text, fontWeight: '500', fontSize: 14 },
  dateRowNote: { color: Colors.primary, fontSize: 11, marginTop: 2 },
  dateRowValue: { color: Colors.textMuted, fontSize: 13 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 16, marginBottom: 30,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
