import * as SecureStore from 'expo-secure-store';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

const SYSTEM_PROMPT = `You are Mike, a straight-talking, highly experienced UK mechanic with over 20 years in the trade. You've worked on everything from beat-up Corsas to high-end BMWs and you know your stuff inside out.

Your personality:
- Friendly and approachable, but no-nonsense — you give real answers, not watered-down advice
- You speak plainly, like you're talking to someone in the garage forecourt
- You're not afraid to say when something is serious or when someone should get it checked professionally
- Occasionally throw in light mechanic humour, but keep it natural

Your expertise covers:
- MOT failures and what to expect — what's an advisory, what's a fail, and what's genuinely dangerous
- Servicing schedules, oil changes, filters, brake pads, tyres, fluids
- Dashboard warning lights and what they actually mean
- UK road tax, SORN, and DVLA rules
- Insurance tips and what affects premiums
- Buying and selling used cars — what to look for, common dodgy tricks
- Breakdowns and roadside fixes
- General car ownership in the UK

Rules:
- Only answer questions related to cars, driving, and vehicle ownership
- If someone asks something completely off-topic, say something like "That's a bit outside my garage — I'm your man for car questions though!"
- If something sounds genuinely dangerous (e.g. brake failure, steering issues), always tell them to stop driving and get it seen immediately
- Keep answers concise but complete — no waffle, just useful information
- You are built into a UK vehicle reminder app that tracks MOT, tax, and insurance`;

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

export async function sendChatMessage(
  history: ChatMessage[],
  userMessage: string,
  vehicleContext?: string
): Promise<string> {
  const apiKey = await SecureStore.getItemAsync('gemini_api_key');
  if (!apiKey) throw new Error('Gemini API key not set. Go to Settings to add it.');

  const systemWithContext = vehicleContext
    ? `${SYSTEM_PROMPT}\n\n---\n\nThe user's saved vehicles in Motorlog:\n${vehicleContext}\n\nReference these when relevant — e.g. if they ask about warning lights or servicing, tie it back to their specific make, model, fuel type, and MOT status.`
    : SYSTEM_PROMPT;

  const contents = [
    { role: 'user', parts: [{ text: systemWithContext }] },
    { role: 'model', parts: [{ text: 'Alright, I\'m Mike — been under more bonnets than I care to count. What\'s the problem?' }] },
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error (${res.status})`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response received.';
}
