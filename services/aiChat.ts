import { supabase } from '@/lib/supabase';
import { selectTopK } from '@/lib/contextSelector';
import type { AIConversation, AIMessage, AIChatResponse } from '@/lib/types';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_CHAT_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_CHAT_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  : null;
const MAX_RECORDS = 20;
const MAX_CONTEXT_CHARS = 12_000;

const CHAT_SYSTEM_PROMPT = `You are a medical assistant AI for a clinic EMR system.
You answer the doctor's questions about a specific patient based ONLY on the provided CONTEXT from the patient's medical records.

RULES:
- Answer ONLY using information present in CONTEXT. Never invent or assume medical data.
- If the requested information is not in CONTEXT, say explicitly: "This information is not available in the patient's records."
- Always cite your sources at the end using the format: SOURCES: [record_id_1, record_id_2, ...]
- Respond in the same language the doctor uses (French, Arabic, or English).
- Be concise, precise, and clinically relevant.
- Never disclose personal identifiers — refer to them as "the patient".`;

function canonicalText(record: { extracted_data: unknown; doctor_corrections: unknown }): string {
  const corrections = record.doctor_corrections;
  const extracted = record.extracted_data;
  const source = corrections ?? extracted;
  if (!source) return '';
  if (typeof source === 'string') return source;
  try {
    const obj = source as { fields?: Array<{ label: string; value: string }> };
    if (obj.fields && Array.isArray(obj.fields)) {
      return obj.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
    }
    return JSON.stringify(source);
  } catch {
    return String(source);
  }
}

async function readFunctionError(error: unknown): Promise<string> {
  const msg = (error as any)?.message ?? 'Unknown function error';
  const ctx = (error as any)?.context;
  if (!ctx || typeof ctx.text !== 'function') {
    return String(msg);
  }
  try {
    const body = await ctx.text();
    if (!body) return String(msg);
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) return `${msg} - ${parsed.error}`;
      return `${msg} - ${body}`;
    } catch {
      return `${msg} - ${body}`;
    }
  } catch {
    return String(msg);
  }
}

async function sendMessageDirectGemini(patientId: string, message: string): Promise<AIChatResponse> {
  if (!GEMINI_CHAT_URL) {
    throw new Error('GEMINI API key is missing for fallback chat.');
  }

  const { data: sessions, error: sessionsErr } = await supabase
    .from('sessions')
    .select('id')
    .eq('patient_id', patientId);

  if (sessionsErr) {
    throw new Error(`Failed to fetch sessions for fallback chat: ${sessionsErr.message}`);
  }

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);

  let records: Array<{
    id: string;
    extracted_data: unknown;
    doctor_corrections: unknown;
    status: string;
    created_at: string;
    session_id: string;
  }> = [];

  if (sessionIds.length > 0) {
    const { data: fetchedRecords, error: recordsErr } = await supabase
      .from('records')
      .select('id, extracted_data, doctor_corrections, status, created_at, session_id')
      .in('session_id', sessionIds)
      .in('status', ['approved', 'needs_review'])
      .order('created_at', { ascending: false })
      .limit(MAX_RECORDS);

    if (recordsErr) {
      throw new Error(`Failed to fetch records for fallback chat: ${recordsErr.message}`);
    }

    records = fetchedRecords ?? [];
  }

  const contextRecords = records.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    text: canonicalText(r),
  }));

  const { selected, context: rawContext } = selectTopK(contextRecords, message, MAX_CONTEXT_CHARS);
  const usedRecordIds = selected.map((r) => r.id);
  const context = rawContext.length > 0
    ? rawContext
    : 'NO RECORDS AVAILABLE — The patient file is empty or contains no extractable data.';

  const response = await fetch(GEMINI_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${CHAT_SYSTEM_PROMPT}\n\nCONTEXT:\n${context}` },
            { text: `Doctor's question: ${message.trim()}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fallback Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const assistantContent = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!assistantContent) {
    throw new Error('Fallback Gemini returned an empty response.');
  }

  const nowIso = new Date().toISOString();
  const ts = Date.now();

  return {
    conversation_id: `fallback-${patientId}`,
    assistant_message: {
      id: `fallback-assistant-${ts}`,
      content: assistantContent,
      source_record_ids: usedRecordIds,
      created_at: nowIso,
    },
  };
}

export async function listConversations(patientId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('patient_id', patientId)
    .order('last_message_at', { ascending: false });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return [];
    }
    throw new Error(`[aiChat] listConversations failed: ${error.message}`);
  }
  return data ?? [];
}

export async function listMessages(conversationId: string): Promise<AIMessage[]> {
  if (!conversationId) return [];

  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return [];
    }
    throw new Error(`[aiChat] listMessages failed: ${error.message}`);
  }
  return data ?? [];
}

export async function sendMessage(
  patientId: string,
  conversationId: string | null,
  message: string
): Promise<AIChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat-patient', {
    body: {
      patient_id: patientId,
      conversation_id: conversationId ?? undefined,
      message,
    },
  });

  if (error) {
    const edgeDetails = await readFunctionError(error);
    console.warn('[aiChat] Edge function failed, switching to fallback Gemini:', edgeDetails);
    try {
      return await sendMessageDirectGemini(patientId, message);
    } catch (fallbackError) {
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`[aiChat] sendMessage failed: ${edgeDetails}. Fallback failed: ${fallbackMsg}`);
    }
  }

  return data as AIChatResponse;
}

export async function createConversation(
  patientId: string,
  initialMessage: string
): Promise<AIChatResponse> {
  return sendMessage(patientId, null, initialMessage);
}
