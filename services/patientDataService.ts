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
import { findDrugInteractions, findDrugWarnings } from '@/data/drugInteractions';

// Text-only calls use flash-lite (1,000 RPD free tier)
// Image scan in geminiService.ts stays on gemini-2.5-flash (20 RPD, needs vision)
const GEMINI_TEXT_MODEL = 'gemini-3.1-flash-lite-preview';

type FdaSnapshotItem = {
  warning: string;
  interaction: string;
};

const FDA_LOCAL_SNAPSHOT: { [key: string]: FdaSnapshotItem } = {
  acetaminophen: {
    warning: 'Liver warning: contains acetaminophen. Severe liver damage if >4000mg/24h.',
    interaction: ''
  },
  aspirin: {
    warning: "Reye's syndrome risk in children recovering from viral illness.",
    interaction: ''
  },
  ramipril: {
    warning: 'ACE inhibitor - angioedema risk.',
    interaction: 'Diuretics: excessive hypotension risk. Lithium: use with caution.'
  },
  tramadol: {
    warning: 'Opioid - hyperalgesia and allodynia risk.',
    interaction: 'See full prescribing info for CYP interactions.'
  },
  allopurinol: {
    warning: 'Serious skin reactions including SJS possible.',
    interaction: 'Increased skin reaction risk with bendamustine and similar agents.'
  },
  prednisone: {
    warning: 'Corticosteroid - increased dosage needed under unusual stress.',
    interaction: ''
  },
  metformin: {
    warning: 'Lactic acidosis risk - see boxed warning.',
    interaction: 'See full prescribing info for ZITUVIMET interactions.'
  },
  ibuprofen: {
    warning: 'Severe allergic reaction possible, especially aspirin-sensitive patients.',
    interaction: ''
  },
  atorvastatin: {
    warning: 'Myopathy and rhabdomyolysis risk, especially age 65+.',
    interaction: 'See full prescribing info for concomitant use restrictions.'
  },
  amlodipine: {
    warning: 'Symptomatic hypotension possible in severe aortic stenosis.',
    interaction: 'Do not exceed simvastatin 20mg daily when co-prescribed.'
  },
  furosemide: {
    warning: 'Potent diuretic - excessive amounts cause profound diuresis.',
    interaction: 'Increases ototoxic potential of aminoglycoside antibiotics.'
  },
  omeprazole: {
    warning: 'Severe skin reactions possible. Do not use if allergic.',
    interaction: ''
  },
  paracetamol: {
    warning: 'Liver warning: contains acetaminophen. Severe liver damage if >4000mg/24h.',
    interaction: ''
  }
};

const INN_TO_FDA: { [key: string]: string } = {
  'paracetamol': 'acetaminophen',
  'paracetamolum': 'acetaminophen',
  'doliprane': 'acetaminophen',
  'efferalgan': 'acetaminophen',
  'dafalgan': 'acetaminophen',
  'acetaminophen': 'acetaminophen',
  'aspirin': 'aspirin',
  'aspirine': 'aspirin',
  'acide acetylsalicylique': 'aspirin',
  'acide acetylsalicylique de lysine': 'aspirin',
  'kardegic': 'aspirin',
  'ramipril': 'ramipril',
  'tramadol': 'tramadol',
  'tramadol chlorhydrate': 'tramadol',
  'allopurinol': 'allopurinol',
  'prednisone': 'prednisone',
  'metformin': 'metformin',
  'metformine': 'metformin',
  'ibuprofen': 'ibuprofen',
  'ibuprofene': 'ibuprofen',
  'atorvastatin': 'atorvastatin',
  'atorvastatine': 'atorvastatin',
  'amlodipine': 'amlodipine',
  'furosemide': 'furosemide',
  'omeprazole': 'omeprazole',
  'omeprazol': 'omeprazole',
  'pravastatine': 'pravastatin',
  'pravastatine sodique': 'pravastatin',
  'pravastatin': 'pravastatin',
};

const SKIP_DRUG_PATTERNS = ['medicament', 'médicament', 'drug ', 'medicine', 'unknown', 'immosal', 'perocet'];

function normalizeDrugName(input: string): string {
  const ascii = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const cleaned = ascii
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(cp|cpr|comprime|comprimes|gel|gelule|gelules|mg|ml|g|ui|sachet|ampoule|inj)\b/g, ' ')
    .replace(/\s*(sodique|chlorhydrate|sel de lysine|calcique|potassique)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return INN_TO_FDA[cleaned] ?? cleaned;
}

function isRealDrugName(name: string): boolean {
  const lower = name.toLowerCase();
  if (name.length < 3) return false;
  return !SKIP_DRUG_PATTERNS.some((p) => lower.includes(p));
}

function compactClinicalText(value: string, max = 95): string {
  if (!value) return '';
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim();
  const sentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() ?? normalized;
  return sentence.slice(0, max).trim();
}

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
      .maybeSingle();

    if (patientError) {
      console.log('[getClinicalNarrative] Patient error:', patientError);
    }

    if (!forceRefresh && patient?.clinical_summary) {
      console.log('[getClinicalNarrative] Using cached clinical_summary');
      return patient.clinical_summary;
    }

    // Calculate age with robust fallbacks
    let computedAge = '';
    let biologicalSex = patient?.gender || patient?.biological_sex || '';
    let weight = patient?.weight_kg ? `${patient.weight_kg}kg` : '';

    if (patient?.date_of_birth) {
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
    const timeoutId = setTimeout(() => controller.abort(), 60000);

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
        .select('id, embedding, diagnoses, drugs, symptoms, extracted_data')
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
     let structured: any = null;

     const hasExistingStructured =
       Array.isArray((record as any).diagnoses) && (record as any).diagnoses.length > 0 &&
       Array.isArray((record as any).drugs) && (record as any).drugs.length > 0;

     if (hasExistingStructured) {
       structured = {
         diagnoses: (record as any).diagnoses ?? [],
         drugs: ((record as any).drugs ?? []).map((name: string) => ({ name })),
         symptoms: (record as any).symptoms ?? [],
         coPrescriptions: [],
         visitDate: null,
         specialty: null,
       };
       console.log('[ingest] Reusing existing diagnoses/drugs/symptoms, skipping NER');
     } else {
       // If payload already looks like extracted_data JSON, parse it locally before calling Gemini NER.
       try {
         const parsed = JSON.parse(localTextPayload);
         if (parsed?.fields && Array.isArray(parsed.fields)) {
           const diagnoses = parsed.fields
             .filter((f: any) => /diagnosis/i.test(String(f?.label ?? '')))
             .map((f: any) => String(f?.value ?? '').trim())
             .filter(Boolean);
           const drugs = parsed.fields
             .filter((f: any) => /medication/i.test(String(f?.label ?? '')))
             .map((f: any) => ({ name: String(f?.value ?? '').trim() }))
             .filter((d: any) => d.name.length > 0);
           const symptoms = parsed.fields
             .filter((f: any) => /symptom|note/i.test(String(f?.label ?? '')))
             .map((f: any) => String(f?.value ?? '').trim())
             .filter(Boolean);

           if (diagnoses.length || drugs.length || symptoms.length) {
             structured = {
               diagnoses,
               drugs,
               symptoms,
               coPrescriptions: [],
               visitDate: null,
               specialty: null,
             };
             console.log('[ingest] Parsed extracted_data payload locally, skipping NER');
           }
         }
       } catch {
         // Not JSON payload; fall through to NER.
       }
     }

     if (!structured) {
       structured = await extractStructuredEntities(localTextPayload);
     }

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

     const drugsArray = Array.isArray(structured.drugs)
       ? structured.drugs.map((d: any) => (typeof d === 'string' ? d : d?.name)).filter(Boolean)
       : [];

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
    // Use only the first 2 drugs to minimize external calls.
    const drugsToCheck = drugNames.slice(0, 2);

    const results: string[] = [];

    for (const rawDrug of drugsToCheck) {
      if (!rawDrug) continue;

      const innName = normalizeDrugName(rawDrug);
      if (!isRealDrugName(innName)) continue;

      const fdaName = INN_TO_FDA[innName] ?? innName;

      // Check local snapshot first - no API call needed.
      const localData = FDA_LOCAL_SNAPSHOT[fdaName] ?? FDA_LOCAL_SNAPSHOT[innName];
      if (localData) {
        const summary = [localData.warning, localData.interaction]
          .filter((s) => s && s.length > 5)
          .join(' | ')
          .substring(0, 200);

        if (summary.length > 10) {
          results.push(`${fdaName}: ${summary}`);
          continue; // Skip live API call entirely for known drugs.
        }
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
      
      // Only hit live FDA for uncommon drugs not covered by local snapshot.
      const url = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:"${encodeURIComponent(fdaName.toUpperCase())}"&limit=1`;
      console.log('[FDA] Searching for:', fdaName, '-> URL:', url);
      const res = await fetch(url);
      
      if (!res.ok) {
        console.warn(`[FDA] ${fdaName} returned ${res.status}`);
        continue;
      }
      
      const json = await res.json();
      const result = json.results?.[0];
      
      if (!result) continue;
      
      const interactions = result.drug_interactions?.[0] || '';
      const keyWarning = result.warnings_and_cautions?.[0] || 
                         result.warnings?.[0] || '';
      
      const summary = compactClinicalText(interactions || keyWarning, 95);
      
      if (summary.length > 20) {
        const entry = `${fdaName}: ${summary}`;
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

export async function getClinicalInsights(patientCode: string, localClinicalData: any = null, forceRefresh: boolean = false): Promise<{ insightText: string, matches: any[] } | null> {
  console.log('[KG INPUT] Fetching insights for patient:', patientCode);

  const CACHE_KEY = `clinical_insights_${patientCode}`;
  if (!forceRefresh) {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      console.log('[KG] Using cached clinical insights for', patientCode);
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.warn('[KG] Failed to parse cached insights', e);
      }
    }
  }

  const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;

  try {
    let currentVector: number[] | string | null = null;
    let patientId: string | null = null;
    let currentRecordId: string | null = null;

    // 1. Get current embedding and patient ID from Supabase
    const { data: patient, error: patientErr } = await supabase.from('patients').select('id').eq('patient_code', patientCode).maybeSingle();

    if (patient) {
      patientId = patient.id;
      const { data: records } = await supabase
        .from('records')
        .select('id, embedding, sessions!inner(patient_id)')
        .eq('sessions.patient_id', patient.id)
        .not('embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (records && records.length > 0) {
        currentRecordId = (records[0] as any).id;
        currentVector = (records[0] as any).embedding;
      }
    }

    // 2. Generate embedding dynamically if not found but data exists
    if (!currentVector && localClinicalData) {
      console.log('[KG] Vector not found in DB, generating on the fly before RPC...');
      const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
      const embedRes = await fetch(embedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: JSON.stringify(localClinicalData) }] },
          output_dimensionality: 768
        })
      });
      const embedRaw = await embedRes.json();
      currentVector = embedRaw?.embedding?.values;
    }

    if (!currentVector) {
      console.log('[KG] No vector available for search even after retry.');
      return null;
    }

    // Convert vector array to string if needed by Supabase pgvector
    const vectorString = Array.isArray(currentVector) ? `[${currentVector.join(',')}]` : currentVector;

    // 3. Call the Supabase RPC to find historical matches
    console.log('[KG] Searching for historical matches (excluding current record)...');
    const { data: rawMatches, error } = await supabase.rpc('match_clinical_records', { 
      query_embedding: vectorString, 
      match_count: 3,
      exclude_id: currentRecordId
    });

    if (error) {
      console.error('[KG] match_clinical_records RPC error:', error);
      return null;
    }

    if (!rawMatches || rawMatches.length === 0) {
      console.log('[KG] Database is completely empty or no valid matches found.');
      return null;
    }

    console.log(`\n--- [KG] Found ${rawMatches.length} Matches ---`);
    const formattedMatches = rawMatches.map((m: any, index: number) => {
      const summary = `Drugs: [${(m.drugs || []).join(', ')}] | Dx: [${(m.diagnoses || []).join(', ')}]`;
      console.log(`Match ${index + 1}: Score ${m.similarity.toFixed(4)} - ${summary}`);
      return {
        id: m.id,
        similarity: m.similarity,
        dataSummary: summary
      };
    });
    console.log('-------------------------------------\n');

    const matchesString = JSON.stringify(rawMatches);
    const localDataString = JSON.stringify(localClinicalData);
    
    // 4. Synthesize with Gemini using strictly DB matches (no fallbacks)
    const systemPrompt = `You are a Senior Clinical Diagnostician and Medical Ontologist. 
You are given the current patient's clinical data and up to 3 mathematically similar historical vectors.
Your task is to act as a Knowledge Graph reasoning engine.
Do NOT just summarize the data or give generic medical advice.
DO:
1. Identify the exact intersecting medical ontology (e.g. shared drug classes, intersecting symptoms, or similar risk factors) between the current patient and historical matches.
2. State concretely if the historical data points to a specific undetected diagnosis or disease progression.
3. Be highly technical, concise, use RxNorm/SNOMED-styled clinical terms, and keep it under 3 sentences. Provide a direct, actionable clinical deduction.`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `CURRENT PATIENT DATA:\n${localDataString}\n\nSIMILAR HISTORICAL CASES:\n${matchesString}` }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    };

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    console.log('[KG] Asking Gemini to synthesize insights...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(geminiPayload)
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error('[KG] Gemini API HTTP error:', res.status, errText);
      return null;
    }

    const geminiData = await res.json();
    
    // Log the full response if insight is missing
    if (!geminiData?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('[KG] Unexpected Gemini response:', JSON.stringify(geminiData, null, 2));
    }

    const insightText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    console.log('[KG] Gemini insight returned:', insightText);

    if (!insightText) {
      return null;
    }

    const finalResult = {
      insightText: "Second Brain:\n" + insightText,
      matches: formattedMatches
    };

    // Save to cache
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalResult));

    return finalResult;

  } catch (e: any) {
    console.error('[KG CATCH] error in getClinicalInsights:', e?.message);
    return null;
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
      .maybeSingle();

    if (!patient) {
      return { problemTree: [], pendingVerifications: [] };
    }

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
