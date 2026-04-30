import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: April 2025</Text>

        <Section title="Overview">
          Motorlog is designed with privacy first. Your vehicle data is stored locally on your device.
          We do not run servers, create user accounts, or collect personal information.
        </Section>

        <Section title="Data stored on your device">
          All of the following is stored only on your phone, never uploaded anywhere:{'\n\n'}
          • Vehicle details (registration, make, colour, expiry dates){'\n'}
          • Service history, mileage logs, fuel logs{'\n'}
          • Monthly payment records, permits and passes{'\n'}
          • HGV check records{'\n'}
          • Pre-drive checklist logs{'\n'}
          • Vehicle notes{'\n'}
          • Reminder preferences and notification settings{'\n\n'}
          Uninstalling the app permanently deletes all of this data.
        </Section>

        <Section title="Data sent to third parties">
          Motorlog connects to three external services. Each is optional or only triggered by you:{'\n\n'}
          {'1. '}DVLA Vehicle Enquiry Service (UK government){'\n'}
          Your vehicle registration number is sent to the DVLA to retrieve MOT status, tax status,
          make, colour, and engine details. This happens when you add a vehicle or tap Refresh.
          DVLA's privacy policy applies: www.gov.uk/dvla{'\n\n'}
          {'2. '}DVSA MOT History API (UK government){'\n'}
          Your registration number is sent to DVSA to retrieve MOT test history and advisory notices.
          This happens when you open the MOT History screen or use Quick Check.
          DVSA's privacy policy applies: www.gov.uk/dvsa{'\n\n'}
          {'3. '}Google Gemini AI{'\n'}
          When you use the Ask Mike feature, your chat messages are sent to Google Gemini.
          If the "Share my saved vehicles" toggle is on, a summary of your vehicle details
          (registration, make, expiry dates) is also included in that request.
          Google's privacy policy applies: policies.google.com/privacy{'\n'}
          You can disable vehicle sharing in Settings → Ask Mike, or simply not use the feature.
        </Section>

        <Section title="Notifications">
          Motorlog schedules local push notifications on your device for MOT, tax, insurance,
          permit, HGV check, and payment reminders. These are processed entirely on-device
          by the Android notification system. No notification content leaves your phone.
        </Section>

        <Section title="No analytics or tracking">
          Motorlog contains no analytics SDKs, crash reporting tools, advertising networks,
          or tracking of any kind. We do not know how many people use the app, what features
          they use, or anything about their behaviour.
        </Section>

        <Section title="No account required">
          There is no sign-up, no login, and no account. Your data belongs to you and lives
          on your device.
        </Section>

        <Section title="Children">
          Motorlog is not directed at children under 13 and does not knowingly collect
          data from children.
        </Section>

        <Section title="Changes to this policy">
          If this policy changes materially, we will update the "Last updated" date above
          and note the change in the Play Store release notes.
        </Section>

        <Section title="Contact">
          Questions about privacy? Reach us through the Play Store listing.
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
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
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text },
  scroll: { padding: 20, paddingBottom: 60 },
  updated: { fontSize: 12, color: Colors.textDim, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8,
  },
  body: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
});
