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
export function parseGeminiResponse(rawText: string): ExtractionResult | null {
  try {
    if (!rawText || typeof rawText !== 'string') {
      return null;
    }

    // Match everything from the first '{' to the last '}'
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      fields: Array.isArray(parsed.fields) ? parsed.fields : [],
      overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0,
      predictionScore: typeof parsed.predictionScore === 'number' ? parsed.predictionScore : 0,
    };
  } catch (error) {
    return null;
  }
}
