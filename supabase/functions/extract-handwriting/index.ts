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
const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const TIMEOUT_MS = 20_000;
const CONFIDENCE_THRESHOLD = 80;

const SYSTEM_PROMPT = `You are a medical handwriting extraction AI for a Hybrid EMR system used in clinics across Algeria.

Your task: Analyze the handwritten medical document image and extract structured clinical data.

CONTEXT:
- Handwriting is often in French, Arabic, or a mix of both
- Expect French medical shorthand: "Matin/Midi/Soir", "1x3/j" (once 3 times per day), "cp" (comprimé/tablet), "inj" (injection), "gtte" (gouttes/drops)
- Expect Arabic medical terms alongside French
- Dosage formats vary: "2x/jour pendant 7j", "1cp matin et soir", etc.

EXTRACT THESE FIELDS:
1. Symptoms — Patient symptoms described by the doctor
2. Diagnosis — Medical diagnosis
3. Medication — Prescribed medication name and strength
4. Dosage — Dosage instructions (frequency, duration)
5. Notes — Additional notes, follow-up instructions, observations

RETURN ONLY THIS JSON (no markdown, no explanation):
{
  "fields": [
    { "label": "Symptoms", "value": "...", "confidence": <0-100> },
    { "label": "Diagnosis", "value": "...", "confidence": <0-100> },
    { "label": "Medication", "value": "...", "confidence": <0-100> },
    { "label": "Dosage", "value": "...", "confidence": <0-100> },
    { "label": "Notes", "value": "...", "confidence": <0-100> }
  ],
  "overallConfidence": <0-100>,
  "predictionScore": <0-100>
}

RULES:
- If a field is illegible, set value to "(?) [best guess]" and confidence below 50
- overallConfidence = weighted average of all field confidences
- predictionScore = your certainty that the extraction is medically accurate
- Be conservative: only score above 90 for clearly legible text
- For partially legible text, include your best guess with appropriate confidence
- Respond with ONLY the JSON object`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      .select('id, session_id, compressed_image_path, status')
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
    const storagePath = record.compressed_image_path;

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: 'No compressed image path for this record' }),
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

    const parsed = JSON.parse(jsonMatch[0]);
    const overallConfidence = parsed.overallConfidence ?? 0;

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
