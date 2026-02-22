// ─── Gemini Service (Client-Side) ────────────────────────────
// Calls our own /api/extract route — NEVER exposes the API key.

import type { ExtractionResult } from "@/lib/types"

/**
 * Send an image to the server-side Gemini extraction endpoint.
 * The server holds the API key; we just send the base64 image.
 */
export async function extractViaAPI(
  imageDataUrl: string
): Promise<ExtractionResult> {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: imageDataUrl }),
    })

    if (!response.ok) {
      console.error("Extraction API returned", response.status)
      return {
        fields: [],
        overallConfidence: 0,
        predictionScore: 0,
        error: true,
      }
    }

    const data: ExtractionResult = await response.json()
    return data
  } catch (error) {
    console.error("Extraction API call failed:", error)
    return {
      fields: [],
      overallConfidence: 0,
      predictionScore: 0,
      error: true,
    }
  }
}
