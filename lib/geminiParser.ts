// ─────────────────────────────────────────────────────────────
// Snap & Sync — Gemini JSON Parser
// ─────────────────────────────────────────────────────────────
//
// Extracts and parses JSON from Gemini's raw text response.
// Handles markdown fences, plain text wrappers, and missing fields.
// ─────────────────────────────────────────────────────────────

import type { ExtractionResult } from './types';

/**
 * Safely parses the raw text from Gemini Vision API into an ExtractionResult.
 * Uses a regex to find the outermost JSON object and strips markdown fences.
 * 
 * @param rawText The raw response text from Gemini
 * @returns Parsed ExtractionResult, or null if unparseable
 */
export function parseGeminiResponse(rawText: string): ExtractionResult {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('[geminiParser] Received empty or invalid response from AI service.');
  }

  // Match everything from the first '{' to the last '}'
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`[geminiParser] AI response did not contain valid JSON metadata. Raw response snippet: "${rawText.slice(0, 100)}..."`);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Safely parse fields and filter out nulls or conversational filler
    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const sanitizedFields = rawFields
      .filter((f: any) => f && f.label && typeof f.label === 'string')
      .map((f: any) => {
        let val = f.value;
        // Clean conversational fillers if Gemini disobeys instructions
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          const labelLower = f.label.trim().toLowerCase();
          
          // Hardcoded sanitation check: if value is literally just the field name
          if (lower === labelLower) {
            val = null;
          } 
          else if (["not specified", "n/a", "none", "unknown", "null"].includes(lower) || lower === "") {
            val = null;
          }
        }
        return {
          label: f.label,
          value: val,
          confidence: typeof f.confidence === 'number' ? f.confidence : 0
        };
      })
      .filter((f: any) => f.value !== null && f.value !== undefined && f.value !== "");

    return {
      fields: sanitizedFields,
      overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0,
      predictionScore: typeof parsed.predictionScore === 'number' ? parsed.predictionScore : 0,
    };
  } catch (error) {
    throw new Error(`[geminiParser] Failed to parse AI JSON. Errors: ${error instanceof Error ? error.message : String(error)}`);
  }
}
