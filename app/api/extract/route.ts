import { NextRequest, NextResponse } from "next/server"

// ─── Gemini 2.5 Flash Vision — Server-Side API Route ─────────
// The API key stays on the server. The client sends an image,
// we call Gemini, and return the parsed extraction result.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ""
const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const TIMEOUT_MS = 15_000

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
- Respond with ONLY the JSON object`

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { imageBase64 } = body as { imageBase64: string }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 }
      )
    }

    // Strip data URL prefix if present
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64

    // Call Gemini with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Data,
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
    })

    clearTimeout(timeout)

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error("Gemini API error:", errorText)
      return NextResponse.json(
        { error: "Gemini API request failed", details: errorText },
        { status: 502 }
      )
    }

    const geminiData = await geminiResponse.json()

    // Extract text from Gemini response
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("Failed to parse Gemini response:", rawText)
      return NextResponse.json({
        fields: [],
        overallConfidence: 0,
        predictionScore: 0,
        error: true,
      })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      fields: parsed.fields ?? [],
      overallConfidence: parsed.overallConfidence ?? 0,
      predictionScore: parsed.predictionScore ?? 0,
    })
  } catch (error) {
    console.error("Extract API error:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { fields: [], overallConfidence: 0, predictionScore: 0, error: true },
        { status: 408 }
      )
    }

    return NextResponse.json(
      { fields: [], overallConfidence: 0, predictionScore: 0, error: true },
      { status: 500 }
    )
  }
}
