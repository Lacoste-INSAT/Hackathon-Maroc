import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
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

    const payload = await req.json();
    
    // Support either direct record_id or webhook payload format
    const recordId = payload.record_id || payload.record?.id;

    if (!recordId) {
      return new Response(JSON.stringify({ error: 'record_id is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch record data
    const { data: record, error: recordError } = await supabase
      .from('records')
      .select('extracted_data, status')
      .eq('id', recordId)
      .single();

    if (recordError || !record) {
      return new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: corsHeaders });
    }

    if (!record.extracted_data) {
        return new Response(JSON.stringify({ message: 'No extracted data to embed' }), { status: 200, headers: corsHeaders });
    }

    // 2. Prepare text to embed
    const data = typeof record.extracted_data === 'string' ? JSON.parse(record.extracted_data) : record.extracted_data;
    const textToEmbed = JSON.stringify(data.fields || data);
    const textPayload = JSON.stringify(data.fields || data);

    // 3. Call Gemini Embeddings API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiPayload = {
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: textPayload }] },
      output_dimensionality: 768
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
        console.error('Gemini error:', errText);
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const embedding = geminiData?.embedding?.values;

    if (!embedding) {
        throw new Error('No embedding returned from Gemini');
    }

    // 4. Update record with embedding
    const { error: updateError } = await supabase
      .from('records')
      .update({ embedding })
      .eq('id', recordId);

    if (updateError) {
        throw new Error(`Failed to update record embedding: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, recordId }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('generate-embedding error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
