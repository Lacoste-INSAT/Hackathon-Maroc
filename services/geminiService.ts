// ─────────────────────────────────────────────────────────────
// Snap & Sync — Gemini API Service
// ─────────────────────────────────────────────────────────────
//
// Directly calls the Google Gemini REST API from the device.
// Replaces the old Supabase Edge Function to allow instant
// UI feedback during the capture flow.
// ─────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';
import { updateRecordExtraction } from './recordRepository';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

import type { ExtractionResult } from '../lib/types';

const GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts handwriting from a local image file directly using the Gemini REST API.
 * 
 * @param imageUri The local file URI (e.g. file://...) of the image.
 * @returns The parsed ExtractionResult object.
 */
export async function extractHandwritingFromBase64(imageUri: string): Promise<ExtractionResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('[geminiService] EXPO_PUBLIC_GEMINI_API_KEY is not set in the environment variables.');
  }

  try {
    // 1. Read the image as a Base64 string
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // 2. Prepare the payload for Gemini 2.5 Flash
    // We explicitly ask for JSON output matching the expected format.
    const prompt = `
      You are an expert medical transcription AI.
      Extract the handwritten text from this medical note.
      Organize the information into Symptoms, Diagnosis, and Medication.
      
      You MUST respond ONLY with a valid, raw JSON object exactly matching this schema:
      {
        "fields": [
          { "label": "Symptoms", "value": "extracted text", "confidence": number (1-100) },
          { "label": "Diagnosis", "value": "extracted text", "confidence": number (1-100) },
          { "label": "Medication", "value": "extracted text", "confidence": number (1-100) }
        ],
        "overallConfidence": number (1-100),
        "predictionScore": number (1-100)
      }
      Do not include markdown blocks like \`\`\`json. Just the raw JSON format.
    `;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg', // Our camera / compress saves as JPEG
                data: base64Image
              }
            }
          ]
        }
      ]
    };

    // 3. Make the REST call with retry/backoff for transient throttling.
    let data: any = null;
    let lastStatus: number | null = null;
    let lastBody = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_PRIMARY_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          }
        );
      } catch (networkErr) {
        lastBody = networkErr instanceof Error ? networkErr.message : String(networkErr);
        console.warn(
          `[geminiService] Gemini network error (attempt ${attempt}/${MAX_RETRIES}):`,
          lastBody
        );
        if (attempt === MAX_RETRIES) {
          throw new Error(`[geminiService] Gemini network error after ${MAX_RETRIES} attempts: ${lastBody}`);
        }
        await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }

      if (response.ok) {
        data = await response.json();
        break;
      }

      lastStatus = response.status;
      lastBody = await response.text();
      console.warn(
        `[geminiService] Gemini HTTP ${response.status} (attempt ${attempt}/${MAX_RETRIES}):`,
        lastBody
      );

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        if (response.status === 429) {
          throw new Error('[geminiService] Gemini quota/rate limit reached (429). Please wait and try again, or use a higher quota API key.');
        }
        throw new Error(`[geminiService] Gemini API error (${response.status})`);
      }

      // Exponential backoff: 1.5s, 3s, 6s
      await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }

    if (!data) {
      if (lastStatus === 429) {
        throw new Error('[geminiService] Gemini quota/rate limit reached (429). Please wait and try again, or use a higher quota API key.');
      }
      console.error('[geminiService] Final Gemini failure payload:', lastBody);
      throw new Error('[geminiService] Gemini API returned no data after retries.');
    }

    // 4. Parse the response
    const candidates = data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('[geminiService] No candidates returned from Gemini.');
    }

    const rawText = candidates[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('[geminiService] Missing text part in Gemini response.');
    }

    // Clean up potential markdown formatting if the AI ignores strict instructions
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsedText = cleanedText.trim();
      const startIndex = parsedText.indexOf('{');
      const endIndex = parsedText.lastIndexOf('}');
      if (startIndex >= 0 && endIndex >= startIndex) {
        const jsonStr = parsedText.substring(startIndex, endIndex + 1);
        const parsedData: ExtractionResult = JSON.parse(jsonStr);
        console.log('[geminiService] Extraction successful:', parsedData);
        // Ensure data exists, fallback if Gemini didn't provide perfectly formatted arrays
        return {
          fields: parsedData.fields || [
            { label: 'Symptoms', value: 'None extracted', confidence: 0 },
            { label: 'Diagnosis', value: 'None extracted', confidence: 0 },
            { label: 'Medication', value: 'None extracted', confidence: 0 }
          ],
          overallConfidence: parsedData.overallConfidence || 0,
          predictionScore: parsedData.predictionScore || 0,
        };
      }
      throw new Error('No JSON object found in Gemini response');
    } catch (parseError) {
      console.error('[geminiService] Failed to parse JSON:', cleanedText);
      // Fallback
      return {
        fields: [
          { label: 'Symptoms', value: 'Parse Error', confidence: 0 },
          { label: 'Diagnosis', value: 'Parse Error', confidence: 0 },
          { label: 'Medication', value: 'Parse Error', confidence: 0 }
        ],
        overallConfidence: 0,
        predictionScore: 0,
        error: true
      };
    }

  } catch (error) {
    console.error('[geminiService] extractHandwritingFromBase64 error:', error);
    throw error;
  }
}
