import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Vehicle } from '../services/db';
import { StatusBadge, getOverallStatus } from './StatusBadge';
import { Colors } from '../constants/colors';

type Props = {
  vehicle: Vehicle;
};

const statusBorderColor = {
  green: Colors.green,
  amber: Colors.amber,
  red: Colors.red,
  unknown: Colors.border,
};

export function VehicleCard({ vehicle: v }: Props) {
  const router = useRouter();
  const overall = getOverallStatus([v.mot_expiry_date, v.tax_due_date, v.insurance_expiry_date]);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: statusBorderColor[overall] }]}
      onPress={() => router.push(`/vehicle/${v.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.reg}>{v.registration_number}</Text>
          <Text style={styles.make}>{v.year_of_manufacture ? `${v.year_of_manufacture} ` : ''}{v.make} · {v.colour}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.fuel}>{v.fuel_type}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textDim} />
        </View>
      </View>

      <View style={styles.badges}>
        <StatusBadge label="MOT" dateStr={v.mot_expiry_date} />
        <StatusBadge label="Tax" dateStr={v.tax_due_date} />
        <StatusBadge label="Insurance" dateStr={v.insurance_expiry_date} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  reg: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  make: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fuel: {
    fontSize: 12,
    color: Colors.textDim,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
});
