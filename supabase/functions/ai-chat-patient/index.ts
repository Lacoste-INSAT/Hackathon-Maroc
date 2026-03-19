import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const TIMEOUT_MS = 30_000;
const MAX_RECORDS = 20;
const MAX_CONTEXT_CHARS = 12_000;

const SYSTEM_PROMPT = `You are a medical assistant AI for a clinic EMR system.
You answer the doctor's questions about a specific patient based ONLY on the provided CONTEXT from the patient's medical records.

RULES:
- Answer ONLY using information present in CONTEXT. Never invent or assume medical data.
- If the requested information is not in CONTEXT, say explicitly: "This information is not available in the patient's records."
- Always cite your sources at the end using the format: SOURCES: [record_id_1, record_id_2, ...]
- Respond in the same language the doctor uses (French, Arabic, or English).
- Be concise, precise, and clinically relevant.
- Never disclose the patient's name or personal identifiers — refer to them as "the patient".`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

function scoreRelevance(text: string, queryTokens: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) score++;
  }
  return score;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: 'AI service not configured' }, 500);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { patient_id, conversation_id, message } = await req.json() as {
      patient_id: string;
      conversation_id?: string;
      message: string;
    };

    if (!patient_id || !message?.trim()) {
      return jsonResponse({ error: 'patient_id and message are required' }, 400);
    }

    const { data: patient, error: patientErr } = await supabaseService
      .from('patients')
      .select('id, clinic_id')
      .eq('id', patient_id)
      .single();

    if (patientErr || !patient) {
      return jsonResponse({ error: 'Patient not found' }, 404);
    }

    const { data: doctor, error: doctorErr } = await supabaseService
      .from('doctors')
      .select('id, clinic_id')
      .eq('id', user.id)
      .single();

    if (doctorErr || !doctor) {
      return jsonResponse({ error: 'Access denied: no doctor profile found for this user' }, 403);
    }

    if (patient.clinic_id && doctor.clinic_id && patient.clinic_id !== doctor.clinic_id) {
      return jsonResponse({ error: 'Access denied: patient belongs to a different clinic' }, 403);
    }

    let persistenceEnabled = true;
    const { error: chatTableProbeError } = await supabaseService
      .from('ai_conversations')
      .select('id')
      .limit(1);

    if (chatTableProbeError) {
      persistenceEnabled = false;
      console.warn('[ai-chat-patient] ai_conversations unavailable, using stateless mode:', chatTableProbeError.message);
    }

    let activeConversationId = conversation_id ?? `ephemeral-${patient_id}`;

    if (persistenceEnabled && conversation_id) {
      const { data: conv, error: convErr } = await supabaseService
        .from('ai_conversations')
        .select('id')
        .eq('id', activeConversationId)
        .eq('doctor_id', user.id)
        .eq('patient_id', patient_id)
        .single();

      if (convErr || !conv) {
        return jsonResponse({ error: 'Conversation not found or access denied' }, 404);
      }
    } else if (persistenceEnabled) {
      // If the doctor does not have a clinic_id, we cannot persist the conversation
      // because ai_conversations.clinic_id is NOT NULL. Fall back to stateless mode.
      if (!doctor || !doctor.clinic_id) {
        console.warn('[ai-chat-patient] doctor.clinic_id missing, falling back to stateless mode');
        persistenceEnabled = false;
      } else {
        const title = message.trim().substring(0, 80);
        const { data: newConv, error: newConvErr } = await supabaseService
          .from('ai_conversations')
          .insert({
            clinic_id: doctor.clinic_id,
            patient_id,
            doctor_id: user.id,
            title,
          })
          .select('id')
          .single();

        if (newConvErr || !newConv) {
          return jsonResponse({ error: 'Failed to create conversation' }, 500);
        }
        activeConversationId = newConv.id;
      }
    }

    if (persistenceEnabled) {
      await supabaseService.from('ai_messages').insert({
        conversation_id: activeConversationId,
        role: 'doctor',
        content: message.trim(),
      });
    }

    type RecordRow = {
      id: string;
      extracted_data: unknown;
      doctor_corrections: unknown;
      status: string;
      created_at: string;
      session_id: string;
    };

    type SessionRow = { id: string };

    const { data: sessions, error: sessionsErr } = await supabaseService
      .from('sessions')
      .select('id')
      .eq('patient_id', patient_id);

    if (sessionsErr) {
      return jsonResponse({ error: `Failed to fetch patient sessions: ${sessionsErr.message}` }, 500);
    }

    const sessionIds = (sessions ?? []).map((s: SessionRow) => s.id);

    let records: RecordRow[] = [];

    if (sessionIds.length > 0) {
      const { data: fetchedRecords, error: recordsErr } = await supabaseService
        .from('records')
        .select('id, extracted_data, doctor_corrections, status, created_at, session_id')
        .in('session_id', sessionIds)
        .in('status', ['approved', 'needs_review'])
        .order('created_at', { ascending: false })
        .limit(MAX_RECORDS);

      if (recordsErr) {
        console.warn('[ai-chat-patient] Failed to fetch records:', recordsErr.message);
      } else {
        records = fetchedRecords ?? [];
      }
    }

    const queryTokens = message
      .toLowerCase()
      .split(/[\s,.;:!?]+/)
      .filter((t: string) => t.length > 2);

    const enriched = (records ?? []).map((r: RecordRow) => ({
      ...r,
      text: canonicalText(r),
    }));

    const scored = enriched
      .filter((r: { text: string }) => r.text.length > 0)
      .map((r: { text: string; id: string }) => ({
        ...r,
        relevance: scoreRelevance(r.text, queryTokens),
      }))
      .sort((a: { relevance: number }, b: { relevance: number }) => b.relevance - a.relevance);

    let context = '';
    const usedRecordIds: string[] = [];

    for (const rec of scored) {
      const chunk = `[Record ${rec.id} | ${rec.created_at}]\n${rec.text}\n\n`;
      if (context.length + chunk.length > MAX_CONTEXT_CHARS) break;
      context += chunk;
      usedRecordIds.push(rec.id);
    }

    if (context.length === 0) {
      context = 'NO RECORDS AVAILABLE — The patient file is empty or contains no extractable data.';
    }

    const startMs = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${context}` },
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

    clearTimeout(timeout);
    const latencyMs = Date.now() - startMs;

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('[ai-chat-patient] Gemini error:', errText);

      if (geminiResponse.status === 429) {
        return jsonResponse({ error: 'AI service is temporarily busy. Please try again shortly.' }, 429);
      }
      return jsonResponse({ error: 'AI service error. Please try again.' }, 502);
    }

    const geminiData = await geminiResponse.json();
    const assistantContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!assistantContent) {
      return jsonResponse({ error: 'AI returned an empty response' }, 502);
    }

    let assistantMsg: { id: string; content: string; source_record_ids: string[]; created_at: string };

    if (persistenceEnabled) {
      const { data: insertedAssistantMsg, error: insertErr } = await supabaseService
        .from('ai_messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'assistant',
          content: assistantContent,
          source_record_ids: usedRecordIds,
          model: GEMINI_MODEL,
          latency_ms: latencyMs,
        })
        .select('id, content, source_record_ids, created_at')
        .single();

      if (insertErr || !insertedAssistantMsg) {
        console.error('[ai-chat-patient] Failed to save assistant message:', insertErr);
        return jsonResponse({ error: 'Failed to save response' }, 500);
      }

      assistantMsg = insertedAssistantMsg;

      await supabaseService
        .from('ai_conversations')
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', activeConversationId);
    } else {
      assistantMsg = {
        id: `ephemeral-${Date.now()}`,
        content: assistantContent,
        source_record_ids: usedRecordIds,
        created_at: new Date().toISOString(),
      };
    }

    return jsonResponse({
      conversation_id: activeConversationId,
      assistant_message: {
        id: assistantMsg.id,
        content: assistantMsg.content,
        source_record_ids: assistantMsg.source_record_ids,
        created_at: assistantMsg.created_at,
      },
    });

  } catch (error) {
    console.error('[ai-chat-patient] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof Error && error.name === 'AbortError' ? 408 : 500;
    return jsonResponse({ error: message }, status);
  }
});
