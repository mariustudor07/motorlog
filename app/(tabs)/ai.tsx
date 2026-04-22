import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendChatMessage, ChatMessage } from '../../services/gemini';
import { getAllVehicles, Vehicle } from '../../services/db';
import { MIKE_CONTEXT_KEY } from './settings';
import { Colors } from '../../constants/colors';

// ── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_KEY = 'mike_rate_limit';
const RATE_LIMIT = 20;       // max messages
const RATE_WINDOW = 3600000; // 1 hour in ms

type RateData = { count: number; windowStart: number };

async function checkRateLimit(): Promise<{ allowed: boolean; minutesLeft?: number }> {
  const raw = await AsyncStorage.getItem(RATE_KEY);
  const now = Date.now();
  const data: RateData = raw ? JSON.parse(raw) : { count: 0, windowStart: now };

  // Reset window if an hour has passed
  if (now - data.windowStart >= RATE_WINDOW) {
    await AsyncStorage.setItem(RATE_KEY, JSON.stringify({ count: 1, windowStart: now }));
    return { allowed: true };
  }

  if (data.count >= RATE_LIMIT) {
    const msLeft = RATE_WINDOW - (now - data.windowStart);
    return { allowed: false, minutesLeft: Math.ceil(msLeft / 60000) };
  }

  await AsyncStorage.setItem(RATE_KEY, JSON.stringify({ ...data, count: data.count + 1 }));
  return { allowed: true };
}

function buildVehicleContext(vehicles: Vehicle[]): string {
  if (vehicles.length === 0) return '';
  return vehicles.map(v => {
    const parts = [
      `${v.registration_number}: ${v.year_of_manufacture ?? ''} ${v.make}`.trim(),
      v.colour ? `Colour: ${v.colour}` : null,
      v.fuel_type ? `Fuel: ${v.fuel_type}` : null,
      v.engine_capacity ? `Engine: ${v.engine_capacity}cc` : null,
      v.mot_expiry_date ? `MOT expires: ${v.mot_expiry_date}` : 'MOT: not set',
      v.tax_due_date ? `Tax due: ${v.tax_due_date}` : 'Tax: not set',
      v.insurance_expiry_date ? `Insurance expires: ${v.insurance_expiry_date}` : null,
    ].filter(Boolean);
    return parts.join(', ');
  }).join('\n');
}

const SUGGESTIONS = [
  'My engine light just came on — what does it mean?',
  'What should I check when buying a used car?',
  'How do I know when my brakes need replacing?',
  'What actually fails an MOT?',
];

export default function AiScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vehicleContext, setVehicleContext] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardOffset(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOffset(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const contextEnabled = await AsyncStorage.getItem(MIKE_CONTEXT_KEY);
        if (contextEnabled !== 'false') {
          const vehicles = getAllVehicles();
          setVehicleContext(buildVehicleContext(vehicles));
        } else {
          setVehicleContext('');
        }
      };
      load();
    }, [])
  );

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;

    const rate = await checkRateLimit();
    if (!rate.allowed) {
      setError(`You've sent ${RATE_LIMIT} messages this hour. Mike needs a breather — try again in ${rate.minutesLeft} minute${rate.minutesLeft === 1 ? '' : 's'}.`);
      return;
    }

    setInput('');
    setError('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: msg }];
    setMessages(newMessages);
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const reply = await sendChatMessage(messages, msg, vehicleContext || undefined);
      setMessages([...newMessages, { role: 'model', text: reply }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Car AI</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>Ask anything about your vehicle</Text>
            {vehicleContext ? (
              <View style={styles.contextBadge}>
                <Ionicons name="car-outline" size={10} color={Colors.green} />
                <Text style={styles.contextBadgeText}>Knows your cars</Text>
              </View>
            ) : null}
          </View>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={18} color={Colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1, marginBottom: keyboardOffset }}>
        {messages.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.emptyState}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={56} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>Ask Mike</Text>
            <Text style={styles.emptyText}>Your no-nonsense mechanic. Ask about warning lights, MOT, buying a car, or anything else under the bonnet.</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => send(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <MessageBubble message={item} />}
            ListFooterComponent={loading ? <TypingIndicator /> : null}
          />
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about your car..."
            placeholderTextColor={Colors.textDim}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MessageBubble({ message: m }: { message: ChatMessage }) {
  const isUser = m.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="car-sport" size={14} color={Colors.primary} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{m.text}</Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatar}>
        <Ionicons name="car-sport" size={14} color={Colors.primary} />
      </View>
      <View style={[styles.bubble, styles.bubbleModel, styles.typingBubble]}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  contextBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.greenDim, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  contextBadgeText: { color: Colors.green, fontSize: 10, fontWeight: '600' },
  clearBtn: {
    padding: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginTop: 4,
  },
  emptyState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  suggestions: { width: '100%', gap: 8, marginTop: 8 },
  suggestionChip: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: { color: Colors.textMuted, fontSize: 13 },
  messageList: { padding: 16, paddingBottom: 8, gap: 12 },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleModel: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 18 },
  bubbleText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: Colors.white },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.redDim,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: Colors.red, fontSize: 12, flex: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
