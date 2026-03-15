import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const TIMEOUT_MS = 15_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    const { patientCode } = await req.json();

    if (!patientCode) {
      return new Response(JSON.stringify({ error: 'patientCode is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch patient demographics
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, date_of_birth, biological_sex, blood_type')
      .eq('patient_code', patientCode)
      .single();

    if (patientError || !patient) {
      return new Response(JSON.stringify({ error: 'Patient not found' }), { status: 404, headers: corsHeaders });
    }

    // Calculate age with robust fallbacks
    let computedAge = 'an unknown age';
    let biologicalSex = 'patient';
    let bloodType = '';

    if (patient) {
      if (patient.date_of_birth) {
        try {
          const dob = new Date(patient.date_of_birth);
          if (!isNaN(dob.getTime())) {
            const diff_ms = Date.now() - dob.getTime();
            const age_dt = new Date(diff_ms); 
            computedAge = `${Math.abs(age_dt.getUTCFullYear() - 1970)}`;
          }
        } catch (e) {
          console.error('[generate-narrative] Error parsing date_of_birth:', e);
        }
      }

      if (patient.biological_sex) {
        biologicalSex = patient.biological_sex;
      }
      
      if (patient.blood_type) {
        bloodType = ` (Blood Type: ${patient.blood_type})`;
      }
    }

    // 2. Fetch all approved records for this patient
    // We join records through sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .eq('patient_id', patient.id);

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    const sessionIds = sessions.map((s: any) => s.id);
    let extractedTexts: string[] = [];

    if (sessionIds.length > 0) {
      const { data: records, error: recordsError } = await supabase
        .from('records')
        .select('extracted_data')
        .in('session_id', sessionIds)
        .eq('status', 'approved')
        .not('extracted_data', 'is', null);

      if (recordsError) throw new Error(`Failed to fetch records: ${recordsError.message}`);

      extractedTexts = records.map((r: any) => {
        const data = typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data) : r.extracted_data;
        return JSON.stringify(data.fields || data);
      });
    }

    if (extractedTexts.length === 0) {
      return new Response(JSON.stringify({ narrative: "No approved clinical data available to generate a summary." }), { status: 200, headers: corsHeaders });
    }

    // 3. Prompt Gemini
    const systemPrompt = `You are an expert medical AI assistant for doctors.
Your task is to review a patient's historical clinical data (symptoms, diagnoses, medications, dosages, notes) and write a single-paragraph professional clinical handover note.

You are writing a summary for a ${computedAge}-year-old ${biologicalSex}${bloodType}.

RULES:
- Start with a concise patient demographic summary (e.g., "${computedAge}yo ${biologicalSex} presenting with...").
- Synthesize all provided data into a cohesive medical narrative.
- Summarize historical diagnoses, chronic conditions, and active medications.
- Be highly professional and brief (1 paragraph max).
- Do not make up information that is not in the extracted data.
- Output ONLY the narrative text, no markdown, no greetings.
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Raw Patient Clinical Data:\n${extractedTexts.join('\n\n')}` }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
      }
    };

    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(geminiPayload),
    });

    clearTimeout(timeout);

    if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error('[generate-narrative] Gemini API HTTP error:', geminiResponse.status, errText);
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const narrative = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!narrative) {
        console.error('[generate-narrative] Gemini API returned empty or invalid content:', JSON.stringify(geminiData));
        throw new Error('Gemini failed to generate narrative.');
    }

    return new Response(JSON.stringify({ narrative }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[generate-narrative] Execution error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Provide a graceful fallback to the client instead of a 500
    return new Response(JSON.stringify({ narrative: "AI narrative temporarily unavailable due to a processing error.", error: message }), { status: 200, headers: corsHeaders });
  }
});
