import { parseGeminiResponse } from '@/lib/geminiParser';

describe('Gemini Parser', () => {
  it('parses valid JSON with all fields perfectly', () => {
    const rawText = `Here is the requested extraction:
{
  "fields": [
    { "label": "Symptoms", "value": "Fever, cough", "confidence": 95 },
    { "label": "Diagnosis", "value": "Viral Infection", "confidence": 90 }
  ],
  "overallConfidence": 92,
  "predictionScore": 90
}`;

    const result = parseGeminiResponse(rawText);
    
    expect(result).not.toBeNull();
    expect(result?.overallConfidence).toBe(92);
    expect(result?.predictionScore).toBe(90);
    expect(result?.fields.length).toBe(2);
    expect(result?.fields[0].value).toBe('Fever, cough');
  });

  it('strips markdown code fences', () => {
    const rawText = "```json\n{\n  \"fields\": [],\n  \"overallConfidence\": 85\n}\n```";
    
    const result = parseGeminiResponse(rawText);
    
    expect(result?.overallConfidence).toBe(85);
    expect(result?.fields).toEqual([]);
  });

  it('returns null for completely empty response', () => {
    expect(parseGeminiResponse('')).toBeNull();
    // @ts-ignore
    expect(parseGeminiResponse(null)).toBeNull();
  });

  it('returns null for plain text without JSON', () => {
    const rawText = 'The patient has a fever but I cannot format this as JSON right now.';
    expect(parseGeminiResponse(rawText)).toBeNull();
  });

  it('defaults missing overallConfidence to 0', () => {
    const rawText = '{ "fields": [] }';
    const result = parseGeminiResponse(rawText);
    
    expect(result?.overallConfidence).toBe(0);
  });

  it('defaults missing fields array to empty array', () => {
    const rawText = '{ "overallConfidence": 50, "predictionScore": 40 }';
    const result = parseGeminiResponse(rawText);
    
    expect(result?.fields).toEqual([]);
  });

  it('returns null for truncated or malformed JSON', () => {
    const rawText = '{ "fields": [ { "label": "Symptoms", "value": "'; // Incomplete
    expect(parseGeminiResponse(rawText)).toBeNull();
  });

  it('ignores extra fields in response', () => {
    const rawText = '{ "fields": [], "overallConfidence": 90, "extraStuff": "ignore me" }';
    const result = parseGeminiResponse(rawText);
    
    expect(result).not.toHaveProperty('extraStuff');
    expect(result?.overallConfidence).toBe(90);
  });
});
