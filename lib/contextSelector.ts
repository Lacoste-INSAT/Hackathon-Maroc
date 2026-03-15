export interface ContextRecord {
  id: string;
  text: string;
  created_at: string;
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.;:!?]+/)
    .filter((t) => t.length > 2);
}

export function scoreRelevance(text: string, queryTokens: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) score++;
  }
  return score;
}

export function selectTopK(
  records: ContextRecord[],
  query: string,
  maxChars: number
): { selected: ContextRecord[]; context: string } {
  const tokens = tokenize(query);

  const scored = records
    .filter((r) => r.text.length > 0)
    .map((r) => ({ ...r, relevance: scoreRelevance(r.text, tokens) }))
    .sort((a, b) => b.relevance - a.relevance);

  let context = '';
  const selected: ContextRecord[] = [];

  for (const rec of scored) {
    const chunk = `[Record ${rec.id} | ${rec.created_at}]\n${rec.text}\n\n`;
    if (context.length + chunk.length > maxChars) break;
    context += chunk;
    selected.push({ id: rec.id, text: rec.text, created_at: rec.created_at });
  }

  return { selected, context };
}
