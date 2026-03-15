// @ts-nocheck
// ─────────────────────────────────────────────────────────────
// Snap & Sync — Supabase Edge Function: extract-handwriting
// ─────────────────────────────────────────────────────────────
//
// Triggered after a record's compressed image is uploaded.
// Downloads the image from Supabase Storage, sends it to
// Gemini 2.5 Flash Vision, and writes the result back to
// the records table.
//
// Deploy: supabase functions deploy extract-handwriting
// ─────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const TIMEOUT_MS = 20_000;
const CONFIDENCE_THRESHOLD = 80;

const SYSTEM_PROMPT = `You are a strict data extraction API for a Hybrid EMR system.

Your task: Analyze the handwritten medical document image and extract structured clinical data.

CONTEXT:
- Handwriting is often in French, Arabic, or a mix of both
- Expect French medical shorthand: "Matin/Midi/Soir", "1x3/j", "cp", "inj", "gtte"
- Expect Arabic medical terms alongside French
- Dosage formats vary

EXTRACT THESE FIELDS:
1. Symptoms
2. Diagnosis
3. Medication
4. Dosage
5. Notes

RETURN ONLY THIS EXACT JSON FORMAT (no markdown, no explanation):
{
  "fields": [
    { "label": "Symptoms", "value": "...or null...", "confidence": <0-100> },
    { "label": "Diagnosis", "value": "...or null...", "confidence": <0-100> },
    { "label": "Medication", "value": "...or null...", "confidence": <0-100> },
    { "label": "Dosage", "value": "...or null...", "confidence": <0-100> },
    { "label": "Notes", "value": "...or null...", "confidence": <0-100> }
  ],
  "overallConfidence": <0-100>,
  "predictionScore": <0-100>
}

CRITICAL RULES:
- If a field (like Diagnosis, Medication, or Symptom) is missing from the document, you MUST return null or "".
- Do NOT output conversational filler like "Not specified", "N/A", "Unknown", or "(?) [best guess]". 
- Do NOT return the name of the field as the value (e.g., if the diagnosis is missing, return null, do NOT return the word "Diagnosis").
- Output valid, raw JSON only. Do not wrap in markdown \`\`\`json blocks.
- overallConfidence = weighted average of all field confidences
- predictionScore = your certainty that the extraction is medically accurate
- Respond with ONLY the JSON object.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toStoragePath(imageUrl: string): string {
  // Preferred format is already a storage path like "doctor/session/record.jpg".
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // Fallback if a public URL was stored in older rows.
  // Expected fragment: /storage/v1/object/public/scan-images/<path>
  const marker = '/storage/v1/object/public/scan-images/';
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return imageUrl;
  return decodeURIComponent(imageUrl.substring(idx + marker.length));
}

Deno.serve(async (req: Request) => {
  // ── Handle CORS Preflight ──
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Validate request ──
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { record_id } = (await req.json()) as { record_id: string };

    if (!record_id) {
      return new Response(
        JSON.stringify({ error: 'record_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Create Supabase client with service role key ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Step 1: Fetch the record to get the storage path ──
    const { data: record, error: recordError } = await supabase
      .from('records')
      .select('id, session_id, image_url, status')
      .eq('id', record_id)
      .single();

    if (recordError || !record) {
      return new Response(
        JSON.stringify({ error: `Record not found: ${record_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 2: Download compressed image from Storage ──
    // The compressed image was uploaded by the sync service at:
    // scan-images/{doctor_id}/{session_id}/{record_id}.jpg
    const storagePath = toStoragePath(record.image_url ?? '');

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: 'No image path for this record' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('scan-images')
      .download(storagePath);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({
          error: 'Failed to download image from storage',
          details: downloadError?.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 3: Convert to base64 ──
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Image = btoa(binary);

    // ── Step 4: Call Gemini Vision API ──
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
              { text: SYSTEM_PROMPT },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json"
        },
      }),
    });

    clearTimeout(timeout);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[extract-handwriting] Gemini API HTTP error:', errorText);

      // Mark the record as needing manual review
      await supabase
        .from('records')
        .update({
          status: 'needs_review',
          flagged_reason: `Gemini API error: ${geminiResponse.status}`,
        })
        .eq('id', record_id);

      return new Response(
        JSON.stringify({ error: 'Gemini API error', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();

    // ── Step 5: Parse the extraction result ──
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[extract-handwriting] Failed to parse:', rawText);

      await supabase
        .from('records')
        .update({
          status: 'needs_review',
          flagged_reason: 'AI returned unparseable response',
        })
        .eq('id', record_id);

      return new Response(
        JSON.stringify({ error: 'Failed to parse Gemini response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse JSON', details: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Hardcoded post-processing to destroy hallucinations
    if (parsed && Array.isArray(parsed.fields)) {
      parsed.fields = parsed.fields.map((f: any) => {
        let val = f.value;
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          const labelLower = (f.label || '').trim().toLowerCase();
          if (
            lower === labelLower || 
            lower.includes('not specified') || 
            lower === 'n/a' || 
            lower === 'none' || 
            lower === 'unknown' || 
            lower === ''
          ) {
            val = null;
          }
        }
        return { ...f, value: val };
      });
    }

    const overallConfidence = parsed?.overallConfidence ?? 0;

    // ── Step 6: Update the record ──
    const isAutoApproved = overallConfidence >= CONFIDENCE_THRESHOLD;

    const { error: updateError } = await supabase
      .from('records')
      .update({
        extracted_data: JSON.stringify(parsed),
        overall_confidence: overallConfidence,
        status: isAutoApproved ? 'approved' : 'needs_review',
        flagged_reason: isAutoApproved
          ? null
          : `Low confidence: ${overallConfidence}% — weakest field: ${
              parsed.fields?.reduce(
                (
                  weakest: { confidence: number; label: string } | null,
                  f: { confidence: number; label: string }
                ) =>
                  !weakest || f.confidence < weakest.confidence ? f : weakest,
                null
              )?.label ?? 'unknown'
            }`,
      })
      .eq('id', record_id);

    if (updateError) {
      console.error('[extract-handwriting] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update record', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isAutoApproved) {
        // Step 7: Automatically trigger embedding generation
        supabase.functions.invoke('generate-embedding', {
          body: { record_id }
        }).catch(err => console.error('[extract-handwriting] Failed to trigger embedding pipeline:', err));
    }

    console.log(
      `[extract-handwriting] Record ${record_id}: ${
        isAutoApproved ? 'auto-approved' : 'needs-review'
      } (${overallConfidence}%)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        record_id,
        status: isAutoApproved ? 'approved' : 'needs_review',
        overallConfidence,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[extract-handwriting] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof Error && error.name === 'AbortError' ? 408 : 500;

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
