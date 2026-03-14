import { supabase } from '@/lib/supabase';
import { getDatabase } from './database';
import type { 
  Record, 
  Session, 
  ExtractionResult, 
  ProblemNode, 
  PatientDataPoint, 
  PendingVerificationItem 
} from '@/lib/types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateLocalInsight, findDrugInteractions, findDrugWarnings } from '@/data/drugInteractions';

// Text-only calls use flash-lite (1,000 RPD free tier)
// Image scan in geminiService.ts stays on gemini-2.5-flash (20 RPD, needs vision)
const GEMINI_TEXT_MODEL = 'gemini-3.1-flash-lite-preview';

export async function getPatientProblemTree(
  patientCode: string,
  isOnline: boolean
): Promise<{
  problemTree: ProblemNode[];
  pendingVerifications: PendingVerificationItem[];
}> {
  // Always fetch offline tree as a base
  const offlineData = await fetchTreeOffline(patientCode);
  
  if (isOnline) {
    const onlineData = await fetchTreeOnline(patientCode);
    
    // Add debug logs to see why tree might be empty
    console.log('[getPatientProblemTree] Online Data:', onlineData);
    console.log('[getPatientProblemTree] Offline Data:', offlineData);

    // If online data is completely empty but offline has data, prefer offline
    if (onlineData.problemTree.length === 0 && offlineData.problemTree.length > 0) {
      console.log('[getPatientProblemTree] Returning offline data because online was empty');
      return offlineData;
    }
    
    // In a real app we'd deeply merge, but for now favor online if it has data
    return onlineData.problemTree.length > 0 ? onlineData : offlineData;
  }
  
  console.log('[getPatientProblemTree] Returning offline data (offline mode)');
  return offlineData;
}

export async function getClinicalNarrative(patientCode: string, localClinicalData: any, forceRefresh: boolean = false): Promise<string | null> {
  try {
    const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.log('[getClinicalNarrative] EXPO_PUBLIC_GEMINI_API_KEY is missing');
      return 'ERROR: EXPO_PUBLIC_GEMINI_API_KEY is missing';
    }

    // 1. Fetch patient demographics
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('patient_code', patientCode)
      .single();

    if (patientError || !patient) {
      console.log('[getClinicalNarrative] Patient not found or error:', patientError);
      return `ERROR: Patient query failed - ${patientError?.message || 'Not found'}`;
    }

    if (!forceRefresh && patient.clinical_summary) {
      console.log('[getClinicalNarrative] Using cached clinical_summary');
      return patient.clinical_summary;
    }

    // Calculate age with robust fallbacks
    let computedAge = '';
    let biologicalSex = patient.gender || patient.biological_sex || '';
    let weight = patient.weight_kg ? `${patient.weight_kg}kg` : '';

    if (patient.date_of_birth) {
      try {
        const dob = new Date(patient.date_of_birth);
        if (!isNaN(dob.getTime())) {
          const diff_ms = Date.now() - dob.getTime();
          const age_dt = new Date(diff_ms); 
          computedAge = `${Math.abs(age_dt.getUTCFullYear() - 1970)}`;
        }
      } catch (e) {
        console.log('[getClinicalNarrative] Error parsing date_of_birth:', e);
      }
    }

    const demographicParts = [];
    if (computedAge) demographicParts.push(`${computedAge}yo`);
    if (biologicalSex) demographicParts.push(biologicalSex);
    if (weight) demographicParts.push(weight);
    const demographicString = demographicParts.join(' ');

    if (!localClinicalData || (Array.isArray(localClinicalData) && localClinicalData.length === 0)) {
      return "ERROR: No local clinical data provided to generate a summary.";
    }

    function prepareNarrativeInput(problemTree: any[]) {
      return problemTree.map(visit => ({
        visitDate: visit.diagnosis,
        diagnoses: visit.diagnoses
          .map((d: any) => d.value)
          .filter((v: string) => 
            v && 
            v.length > 0 && 
            !v.includes('Not specified') &&
            !v.includes('N/A')
          ),
        medications: visit.medications
          .map((m: any) => ({
            value: (() => {
              const firstLine = m.value?.split('\n')[0] ?? ''
              const clean = firstLine
                .replace(/^\d+[\.\)]\s*/, '')
                .replace(/\(.*?\)/g, '')
                .replace(/Instructions:.*/i, '')
                .trim()
                .substring(0, 60)
              return clean
            })(),
            confidence: m.confidence
          }))
          .filter((m: any) => 
            m.value && 
            m.value.length > 5 &&
            m.confidence >= 75
          )
          .filter((m: any, idx: number, arr: any[]) => 
            arr.findIndex(x => 
              x.value?.substring(0, 30) === m.value?.substring(0, 30)
            ) === idx
          ),
        symptoms: visit.symptoms
          .map((s: any) => s.value)
          .filter((v: string) => 
            v && 
            v.length > 0 && 
            !v.includes('Not specified') &&
            !v.includes('N/A')
          )
      }));
    }

    const cleanedData = prepareNarrativeInput(localClinicalData);
    const localDataString = JSON.stringify(cleanedData);

    // 3. Prompt Gemini
    const systemPrompt = `You are a senior clinical AI assistant embedded in a physician-facing 
medical app. Your output will be read by a doctor on a mobile screen 
in under 60 seconds. Precision and brevity are non-negotiable.

Your task: synthesize the provided structured patient records into a 
concise clinical handover note.

OUTPUT FORMAT — follow this exact structure, no exceptions:

Keywords: [3-5 comma-separated clinical keywords]

Symptoms: [Chief complaint and reported symptoms. 
  1-2 sentences max. If no symptoms reported, omit this section entirely.]

Diagnoses: [Active diagnoses first, then chronic conditions. 
  Use ICD-style terminology where possible.
  If no confirmed diagnosis exists, write: "No confirmed diagnosis. 
  Symptom-driven management." Do not invent diagnoses.]

Medications:
  Each on its own line in this format:
  - [INN drug name] [dose] — [frequency] — [duration]
  Flag dangerous combinations as [WARNING].
  If drug name is a brand name, normalize to INN in brackets after it.

Clinical Impression: [One sentence. State trajectory: 
  Acute / Stable / Deteriorating / Chronic follow-up.]

STRICT RULES:
1. Never write "unknown age", "unknown sex", or acknowledge 
   missing demographic data. Omit demographics entirely if absent.
2. If a section has no data, skip the entire section header.
3. Never dump raw prescription text. Every medication must follow 
   the bullet format above.
4. Never use markdown symbols (* ** # etc). Plain text only.
5. If multiple visits are present, synthesize across all of them.
   Note trajectory. Only include the 3 most recent visits.
6. Never hallucinate diagnoses, lab values, or clinical findings 
   not present in the input data.
7. Maximum 150 words total.

Patient Demographics: ${demographicString.length > 0 ? demographicString : 'Not provided'}`;

    const GEMINI_MODEL = GEMINI_TEXT_MODEL;
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Raw Patient Clinical Data:\n${localDataString}` }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(geminiPayload),
    });

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.log('[getClinicalNarrative] Gemini API HTTP error:', geminiResponse.status, errText);
        return `ERROR: Gemini API failed - ${geminiResponse.status} ${errText}`;
    }

    console.log('[PROMPT]', systemPrompt);
    console.log('[getClinicalNarrative] Sending prompt to Gemini with data:', localDataString);

    const geminiData = await geminiResponse.json();
    if (geminiData?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      console.warn('[NARRATIVE] Truncated by token limit');
    }
    const rawNarrative = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!rawNarrative) {
        console.log('[getClinicalNarrative] Gemini API returned empty or invalid content');
        return `ERROR: Gemini API returned empty or invalid content (no candidates present).`;
    }

    const cleanOutput = (text: string) => text
      .split('\n')
      .filter(line => {
        const trimmed = line.trim()
        if (trimmed === 'Symptoms:' || 
            trimmed === 'Diagnoses:' || 
            trimmed === 'Medications:' ||
            trimmed === 'Clinical Impression:' ||
            trimmed.endsWith('No subjective complaints documented.') ||
            trimmed.endsWith('No objective findings documented.') ||
            /not specified/i.test(trimmed) ||
            /unspecified/i.test(trimmed) ||
            /not provided/i.test(trimmed))
          return false
        return trimmed.length > 0
      })
      .join('\n');
      
    const narrative = cleanOutput(rawNarrative);

    // Save newly generated narrative back to database cache
    const { error: updateError } = await supabase
      .from('patients')
      .update({ clinical_summary: narrative })
      .eq('id', patient.id);

    if (updateError) {
      console.log('[getClinicalNarrative] Failed to cache narrative:', updateError);
    }

    return narrative;

  } catch (err: any) {
    console.log('[getClinicalNarrative] Request failed:', err);
    return `ERROR: ${err?.message || 'Unknown catch error'}`;
  }
}

export async function extractStructuredEntities(ordonnance: string) {
  console.log('[NER] Input text length:', ordonnance?.length);
  console.log('[NER] Input preview:', ordonnance?.substring(0, 100));

  const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is missing');

  const systemPrompt = `You are a biomedical Named Entity Recognition engine. 
  Given a raw medical prescription (ordonnance) or clinical notes, extract all 
  structured entities and return ONLY a valid JSON object 
  with no markdown, no explanation, no preamble.

  Return this exact schema:
  {
    "diagnoses": ["string"],
    "drugs": [{
      "name": "string",
      "dosage": "string",
      "frequency": "string",
      "duration": "string"
    }],
    "symptoms": ["string"],
    "coPrescriptions": [["string", "string"]],
    "visitDate": "string | null",
    "specialty": "string | null"
  }

  If a field is not present in the ordonnance, use null or [].
  Normalize all drug names to their International Nonproprietary Name (INN).
  Never invent data. Only extract what is explicitly present.
  If no entity is found for a field, return an empty array [].
  Never write explanatory text like "N/A" or "not found" as array values.`;

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    console.log('[NER] Calling Gemini...');
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: ordonnance }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { 
          temperature: 0.1, 
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json" 
        }
      })
    });
    
    console.log('[NER] Raw response type:', typeof res);
    const data = await res.json();
    console.log('[NER] Raw response:', JSON.stringify(data)?.substring(0, 500));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.log('[NER] Parsed result:', JSON.stringify({ diagnoses: [], drugs: [], symptoms: [], coPrescriptions: [], visitDate: null, specialty: null }));
      return { diagnoses: [], drugs: [], symptoms: [], coPrescriptions: [], visitDate: null, specialty: null };
    }
    
    console.log('[NER] Raw text (first 300):', text?.substring(0, 300));

    // Strip markdown fences if present
    const cleaned = text
      ?.replace(/```json\s*/gi, '')
      ?.replace(/```\s*/gi, '')
      ?.trim()
  
    let result: any
    try {
      result = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[NER] JSON parse failed:', parseErr)
      console.error('[NER] Cleaned text was:', cleaned)
      // Return safe default — do NOT throw here
      return {
        diagnoses: [],
        drugs: [],
        symptoms: [],
        coPrescriptions: [],
        visitDate: null,
        specialty: null
      }
    }
  
    // Validate required fields exist
    if (!Array.isArray(result.diagnoses)) result.diagnoses = []
    if (!Array.isArray(result.drugs)) result.drugs = []
    if (!Array.isArray(result.symptoms)) result.symptoms = []
    
    // Filter coPrescriptions if less than 2 drugs are present
    if (!result.drugs || result.drugs.length < 2) {
      result.coPrescriptions = [];
    }
    
    console.log('[NER] Parsed successfully:', JSON.stringify(result));
    return result;
  } catch(e: any) {
    console.error('[NER] CRASHED with:', e?.message ?? 'null error object')
    console.error('[NER] Type of error:', typeof e, JSON.stringify(e))
    return { diagnoses: [], drugs: [], symptoms: [], coPrescriptions: [], visitDate: null, specialty: null }
  }
}

export async function ingestOrdonnanceIntoGraph(
  recordId: string, 
  localTextPayload: string
) {
  try {
     const { data: record, error: recordErr } = await supabase
        .from('records')
        .select('id, embedding')
        .eq('id', recordId)
        .single();
        
     if (recordErr || !record) {
       console.error('[ingest] Record not found in Supabase:', recordId);
       return;
     }
     if (record.embedding !== null) {
       console.log(`[ingest] Already embedded, skipping: ${recordId}`);
       return;
     }

     if (!localTextPayload || localTextPayload.trim().length < 10) {
       console.error('[ingest] Empty localTextPayload for record:', recordId);
       return;
     }

     console.log('[ingest] Text payload length:', localTextPayload.length);
     const structured = await extractStructuredEntities(localTextPayload);
     const structuredString = JSON.stringify(structured);

     const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
     const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
     
     const embedRes = await fetch(embedUrl, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         model: 'models/gemini-embedding-001',
         content: { parts: [{ text: structuredString }] },
         output_dimensionality: 768
       })
     });
     
     const embedRaw = await embedRes.json();
     console.log('[EMBED] HTTP status:', embedRes.status);
     console.log('[EMBED] Raw response (first 200):', 
       JSON.stringify(embedRaw)?.substring(0, 200));

     const vector = embedRaw?.embedding?.values;
     
     if (!vector || !Array.isArray(vector)) {
       console.error('[EMBED] No vector returned. Full response:', JSON.stringify(embedRaw));
       throw new Error(`Embedding API failed: ${JSON.stringify(embedRaw?.error)}`);
     }
     
     console.log('[EMBED] Vector dimensions:', vector.length);

     const drugsArray = structured.drugs ? structured.drugs.map((d: any) => d.name) : [];

     const { data: updateResult, error: updateErr, count } = 
       await supabase
         .from('records')
         .update({
           embedding: `[${vector.join(',')}]`,
           diagnoses: structured.diagnoses || [],
           drugs: drugsArray,
           symptoms: structured.symptoms || []
         })
         .eq('id', recordId)
         .select('id')   // ← this forces Supabase to return affected rows

     console.log('[ingest] Update result:', JSON.stringify(updateResult))
     console.log('[ingest] Update error:', JSON.stringify(updateErr))
   
     if (!updateResult || updateResult.length === 0) {
       console.error('[ingest] UPDATE WROTE 0 ROWS for record:', recordId)
       console.error('[ingest] This is an RLS block or wrong recordId')
       // Run a diagnostic SELECT to confirm the record exists
       const { data: checkRow } = await supabase
         .from('records')
         .select('id, session_id, status')
         .eq('id', recordId)
         .single()
       console.error('[ingest] Record visible to current user?', 
         JSON.stringify(checkRow))
     } else {
       console.log(`[ingestOrdonnanceIntoGraph] Upserted embedding and arrays for record ${recordId}`);
     }
  } catch (err) {
    console.error('[ingestOrdonnanceIntoGraph] Request failed:', err);
  }
}

export async function getDrugSafetyData(drugNames: string[]): Promise<string> {
  if (!drugNames || drugNames.length === 0) return '';
  
  try {
    // Use only the first 3 drugs to avoid rate limits
    const drugsToCheck = drugNames.slice(0, 3);
    const results: string[] = [];
    
    // 1. INN → FDA name mapping for common European/French drugs
    const INN_TO_FDA: { [key: string]: string } = {
      'paracetamol': 'acetaminophen',
      'paracétamol': 'acetaminophen',
      'ibuprofen': 'ibuprofen',
      'ibuprofène': 'ibuprofen',
      'amoxicillin': 'amoxicillin',
      'amoxicilline': 'amoxicillin',
      'tramadol': 'tramadol',
      'tramadol chlorhydrate': 'tramadol',
      'metformin': 'metformin',
      'metformine': 'metformin',
      'amlodipine': 'amlodipine',
      'atorvastatin': 'atorvastatin',
      'atorvastatine': 'atorvastatin',
      'omeprazole': 'omeprazole',
      'oméprazole': 'omeprazole',
      'salbutamol': 'albuterol',
      'frusemide': 'furosemide',
      'furosemide': 'furosemide',
      'furosémide': 'furosemide',
      'pravastatine sodique': 'pravastatin',
      'pravastatine': 'pravastatin',
      'pravastatin': 'pravastatin',
      'acide acetylsalicylique': 'aspirin',
      'acide acétylsalicylique': 'aspirin',
      'aspirine': 'aspirin',
      'ramipril': 'ramipril',
      'allopurinol': 'allopurinol',
      'prednisone': 'prednisone',
      'prednisolone': 'prednisolone',
      'vogalene': 'metopimazine',
      'spasfon': 'phloroglucinol',
      'doliprane': 'acetaminophen',
      'efferalgan': 'acetaminophen',
      'dafalgan': 'acetaminophen',
      'kardegic': 'aspirin',
    };
    
    // 2. Filter out placeholder/unknown drug names
    const SKIP_PATTERNS = ['médicament', 'medicament', 'drug ', 'medicine', 'unknown', 'immosal', 'perocet'];
    
    for (const drug of drugsToCheck) {
      if (!drug) continue;
      const innName = drug.toLowerCase().trim();
      
      // Skip placeholder names
      if (SKIP_PATTERNS.some(p => innName.includes(p))) {
        console.log('[FDA] Skipping placeholder drug name:', drug);
        continue;
      }
      
      // Try exact match first, then try stripping French suffixes
      let fdaName = INN_TO_FDA[innName];
      if (!fdaName) {
        // Try without common suffixes like "sodique", "chlorhydrate"
        const stripped = innName
          .replace(/\s*(sodique|chlorhydrate|sel de lysine|calcique|potassique)$/i, '')
          .trim();
        fdaName = INN_TO_FDA[stripped] ?? stripped;
      }
      
      const cacheKey = `fda_safety_${fdaName}`;
      
      // Check 24h AsyncStorage cache first
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 86_400_000) {
          results.push(data);
          continue;
        }
      }
      
      const url = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:"${encodeURIComponent(fdaName.toUpperCase())}"&limit=1`;
      console.log('[FDA] Searching for:', fdaName, '→ URL:', url);
      const res = await fetch(url);
      
      if (!res.ok) {
        console.warn(`[FDA] ${drug} returned ${res.status}`);
        continue;
      }
      
      const json = await res.json();
      const result = json.results?.[0];
      
      if (!result) continue;
      
      // Extract ONLY drug interactions (most actionable for doctors)
      // Fall back to key warning if no interactions section exists
      const interactions = result.drug_interactions?.[0] || '';
      const keyWarning = result.warnings_and_cautions?.[0] || 
                         result.warnings?.[0] || '';
      
      // Use interactions if available, otherwise extract first sentence of warnings
      let summary = '';
      if (interactions.length > 10) {
        summary = interactions.substring(0, 120).trim();
      } else if (keyWarning.length > 10) {
        // Just the first sentence of the warning
        const firstSentence = keyWarning.split('.')[0];
        summary = firstSentence.substring(0, 120).trim();
      }
      
      if (summary.length > 20) {
        const entry = `${drug}: ${summary}`;
        results.push(entry);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          data: entry,
          timestamp: Date.now()
        }));
      }
    }
    
    return results.join('\n');
    
  } catch (e: any) {
    console.error('[FDA API] Failed:', e?.message);
    return '';  // return empty, not a fallback string
  }
}

export async function getClinicalInsights(patientCode: string, localClinicalData: any = null): Promise<string> {
  console.log('[KG INPUT] problemTree:', 
    JSON.stringify(localClinicalData?.length), 
    'medications sample:', 
    JSON.stringify(localClinicalData?.[0]?.medications?.[0]?.value)
  );

  try {
    // Step 1: Extract all drug names from localClinicalData
    const allDrugNames: string[] = [];
    if (localClinicalData && Array.isArray(localClinicalData)) {
      for (const visit of localClinicalData) {
        if (visit.medications && Array.isArray(visit.medications)) {
          for (const med of visit.medications) {
            const name = (med.value ?? med)?.toString().split('\n')[0]?.trim();
            if (name && name.length > 2) {
              // Extract just the drug name (before dosage)
              const drugOnly = name
                .replace(/^\d+[\.\)]\s*/, '')
                .split(/\s+\d/)[0] // cut before first number (dosage)
                .trim();
              if (drugOnly.length > 2) allDrugNames.push(drugOnly);
            }
          }
        }
      }
    }
    
    console.log('[KG] Extracted drug names:', allDrugNames);
    
    // Step 2: LOCAL KNOWLEDGE — always works, no API needed
    const localInsight = generateLocalInsight(allDrugNames);
    console.log('[KG] Local insight length:', localInsight.length);
    
    // Step 3: Try to get Supabase-stored drug data (from previous NER)
    let supabaseDrugs: string[] = [];
    try {
      const { data: patient } = await supabase.from('patients').select('id').eq('patient_code', patientCode).single();
      if (patient) {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('patient_id', patient.id);
        
        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          const { data: records } = await supabase
            .from('records')
            .select('drugs')
            .in('session_id', sessionIds)
            .not('drugs', 'is', null)
            .limit(5);
          
          if (records) {
            for (const r of records) {
              if (Array.isArray(r.drugs)) {
                supabaseDrugs.push(...r.drugs);
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('[KG] Supabase drug lookup skipped:', (e as any)?.message);
    }
    
    // Merge all drug sources
    const allDrugs = [...new Set([...allDrugNames, ...supabaseDrugs])];
    console.log('[KG] Total drugs for analysis:', allDrugs);
    
    // Step 4: Get FDA data for the combined drug list (if any real drugs)
    const realDrugs = allDrugs.filter(d => 
      d.length > 3 && 
      !/médicament|medicament|unknown/i.test(d)
    ).slice(0, 3);
    
    const fdaData = realDrugs.length > 0 ? await getDrugSafetyData(realDrugs) : '';
    
    // Step 5: Build the final insight — local knowledge FIRST, FDA as enrichment
    const parts: string[] = [];
    
    if (localInsight.length > 0) {
      parts.push(localInsight);
    }
    
    if (fdaData.length > 0) {
      parts.push('');
      parts.push('FDA Alerts:');
      parts.push(fdaData);
    }
    
    // If we have SOMETHING to show, return it
    if (parts.length > 0) {
      return parts.join('\n');
    }
    
    // Truly nothing — no drugs found at all
    return '';
    
  } catch (e: any) {
    console.error('[KG CATCH] typeof e:', typeof e);
    console.error('[KG CATCH] e.message:', e?.message);
    return '';
  }
}


// ── Shared Parsing Logic ────────────────────────────────────

function processRawData(
  records: any[],
  sessionsMap: Map<string, any>
): {
  problemTree: ProblemNode[];
  pendingVerifications: PendingVerificationItem[];
} {
  const problemNodesMap = new Map<string, ProblemNode>();
  const pendingVerifications: PendingVerificationItem[] = [];

  for (const record of records) {
    const session = sessionsMap.get(record.session_id);
    if (!session) continue;

    const dateRecorded = record.created_at || session.started_at || new Date().toISOString();
    let extractedData: ExtractionResult | null = null;
    
    // Safety Parsing as requested
    if (record.extracted_data) {
      try {
        if (typeof record.extracted_data === 'string') {
          extractedData = JSON.parse(record.extracted_data);
          console.log(`[patientDataService] Successfully parsed string JSON for record ${record.id}`);
        } else {
          // Sometimes Supabase returns parsed JSON directly
          extractedData = record.extracted_data;
          console.log(`[patientDataService] Used direct object JSON for record ${record.id}`);
        }
      } catch (err) {
        console.warn(`[patientDataService] Failed to parse extracted_data for record ${record.id}:`, err);
        console.warn(`[patientDataService] Raw string was:`, record.extracted_data);
        // We will skip structurally bad JSON, but we can't do much if it's completely unparseable
        continue;
      }
    }

    if (!extractedData || !extractedData.fields) {
      continue;
    }

    const isRecordApproved = record.status === 'approved';
    const isNeedsReview = record.status === 'needs_review' || (record.overall_confidence ?? 0) < 80;

    const dateObj = new Date(dateRecorded);
    const formattedDate = `${dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - Clinical Visit`;
    const groupKey = formattedDate;

    if (!problemNodesMap.has(groupKey)) {
      problemNodesMap.set(groupKey, {
        diagnosis: groupKey,
        medications: [],
        symptoms: [],
        diagnoses: []
      });
    }

    const node = problemNodesMap.get(groupKey)!;

    // Process fields
    for (const field of extractedData.fields) {
      const labelLC = field.label.toLowerCase();
      
      // If the record needs review or if this specific field is low confidence but record isn't approved
      if (isNeedsReview && !isRecordApproved) {
        // Add to pending verifications (only add meaningful fields, skip Empty/nulls if applicable)
        if (field.value && field.value !== '(?) [best guess]') {
           pendingVerifications.push({
             id: `${record.id}-${field.label}`,
             recordId: record.id,
             sessionId: record.session_id,
             dateRecorded,
             originalImagePath: record.original_image_path,
             fieldLabel: field.label,
             fieldValue: field.value,
             confidence: field.confidence,
             overallConfidence: record.overall_confidence ?? 0
           });
        }
      }

      // Add to structured tree
      const dataPoint: PatientDataPoint = {
        id: `${record.id}-${field.label}`,
        value: field.value,
        confidence: field.confidence,
        isVerified: isRecordApproved,
        dateRecorded,
        sessionId: record.session_id,
        recordId: record.id
      };

      if (labelLC.includes('diagnosis')) {
          if (!node.diagnoses) node.diagnoses = [];
          node.diagnoses.push(dataPoint);
      } else if (labelLC.includes('medication') || labelLC.includes('dosage')) {
         // Optionally, combine Medication + Dosage logic, but for now just push to medications list
         // If it's pure dosage, we might want to attach it to medication.
         // Given the prompt structure, they are separate fields.
         if (labelLC.includes('medication')) {
            node.medications.push(dataPoint);
         } else if (labelLC.includes('dosage')) {
            // we will add dosage as a symptom/note or just keep it in meds
            node.medications.push({ ...dataPoint, value: `Dosage: ${field.value}` });
         }
      } else if (labelLC.includes('symptom') || labelLC.includes('notes')) {
          node.symptoms.push(dataPoint);
      }
    }
  }

  // Convert map to array
  const problemTree = Array.from(problemNodesMap.values());

  return {
    problemTree,
    pendingVerifications
  };
}


// ── Online Fetch ────────────────────────────────────────────

async function fetchTreeOnline(patientCode: string) {
  try {
    // First get the patient UUID from patient_code
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('patient_code', patientCode)
      .single()
    
    if (!patient) return { problemTree: [], pendingVerifications: [] }

    // 1. Fetch sessions
    const { data: sessions, error: sessionErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('patient_id', patient.id);

    if (sessionErr || !sessions || sessions.length === 0) {
      return { problemTree: [], pendingVerifications: [] };
    }

    const sessionIds = sessions.map(s => s.id);
    const sessionsMap = new Map(sessions.map(s => [s.id, s]));

    // 2. Fetch all records for these sessions
    const { data: records, error: recordsErr } = await supabase
      .from('records')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (recordsErr || !records) {
      return { problemTree: [], pendingVerifications: [] };
    }

    return processRawData(records, sessionsMap);
  } catch (error) {
    console.error('[patientDataService] Online fetch failed:', error);
    // Fallback to offline on failure
    return fetchTreeOffline(patientCode);
  }
}

// ── Offline Fetch ───────────────────────────────────────────

let offlineFetchPromise: Promise<any> | null = null;

async function fetchTreeOffline(patientCode: string) {
  if (offlineFetchPromise) {
    return offlineFetchPromise;
  }

  offlineFetchPromise = (async () => {
    try {
      const db = getDatabase();

      let sessions: any[] = [];
      const sessionsStmt = await db.prepareAsync(`SELECT * FROM sessions WHERE patient_code = ?`);
      try {
        const result = await sessionsStmt.executeAsync<any>([patientCode]);
        sessions = await result.getAllAsync();
      } finally {
        await sessionsStmt.finalizeAsync();
      }

      if (sessions.length === 0) {
        return { problemTree: [], pendingVerifications: [] };
      }

      const sessionIds = sessions.map(s => s.id);
      const sessionsMap = new Map(sessions.map(s => [s.id, s]));

      const placeholders = sessionIds.map(() => '?').join(',');
      let records: any[] = [];
      const recordsStmt = await db.prepareAsync(`SELECT * FROM records WHERE session_id IN (${placeholders}) ORDER BY created_at DESC`);
      try {
        const result = await recordsStmt.executeAsync<any>(sessionIds);
        records = await result.getAllAsync();
      } finally {
        await recordsStmt.finalizeAsync();
      }

      return processRawData(records, sessionsMap);
    } catch (error) {
      console.error('[patientDataService] [fetchTreeOffline] failed, returning empty:', error);
      return { problemTree: [], pendingVerifications: [] };
    } finally {
      offlineFetchPromise = null;
    }
  })();

  return offlineFetchPromise;
}
