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

    // Find Diagnosis to group by
    const diagnosisField = extractedData.fields.find(f => f.label.toLowerCase() === 'diagnosis');
    const diagnosisName = diagnosisField?.value 
      ? diagnosisField.value 
      : 'Uncategorized Observations';

    if (!problemNodesMap.has(diagnosisName)) {
      problemNodesMap.set(diagnosisName, {
        diagnosis: diagnosisName,
        medications: [],
        symptoms: []
      });
    }

    const node = problemNodesMap.get(diagnosisName)!;

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

      if (labelLC.includes('medication') || labelLC.includes('dosage')) {
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
    // 1. Fetch sessions
    const { data: sessions, error: sessionErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('patient_code', patientCode);

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

async function fetchTreeOffline(patientCode: string) {
  const db = getDatabase();

  try {
    const sessions = await db.getAllAsync<any>(
      `SELECT * FROM sessions WHERE patient_code = ?`,
      [patientCode]
    );

    if (sessions.length === 0) {
      return { problemTree: [], pendingVerifications: [] };
    }

    const sessionIds = sessions.map(s => s.id);
    const sessionsMap = new Map(sessions.map(s => [s.id, s]));

    // Use placeholders for IN clause
    const placeholders = sessionIds.map(() => '?').join(',');
    const records = await db.getAllAsync<any>(
      `SELECT * FROM records WHERE session_id IN (${placeholders}) ORDER BY created_at DESC`,
      sessionIds
    );

    return processRawData(records, sessionsMap);
  } catch (error) {
    console.error('[patientDataService] Offline fetch failed:', error);
    return { problemTree: [], pendingVerifications: [] };
  }
}
