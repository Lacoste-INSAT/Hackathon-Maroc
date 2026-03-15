import fs from 'node:fs/promises';

const DRUGS = [
  'acetaminophen',
  'aspirin',
  'ramipril',
  'tramadol',
  'allopurinol',
  'prednisone',
  'metformin',
  'ibuprofen',
  'atorvastatin',
  'amlodipine',
  'furosemide',
  'omeprazole'
];

async function fetchLabel(drug) {
  const q = encodeURIComponent(drug.toUpperCase());
  const url = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:%22${q}%22&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const row = data?.results?.[0];
  if (!row) return null;

  const compact = (value, max = 110) => {
    if (!value || typeof value !== 'string') return '';
    const normalized = value
      .replace(/\s+/g, ' ')
      .replace(/\s*\[[^\]]*\]/g, '')
      .trim();
    const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() ?? normalized;
    const cleaned = firstSentence
      .replace(/^\d+(\.\d+)*\s*/, '')
      .replace(/^[.\-:\s]+/, '')
      .trim();
    if (cleaned.length >= 20) {
      return cleaned.slice(0, max).trim();
    }

    return normalized
      .replace(/^\d+(\.\d+)*\s*/, '')
      .replace(/^[.\-:\s]+/, '')
      .slice(0, max)
      .trim();
  };

  const interaction = compact(row?.drug_interactions?.[0] ?? '', 95);
  const warning = compact(row?.warnings_and_cautions?.[0] ?? row?.warnings?.[0] ?? '', 95);

  if (!interaction && !warning) return null;

  return {
    drug,
    source: 'openFDA',
    downloadedAt: new Date().toISOString(),
    interaction,
    warning
  };
}

async function run() {
  const items = [];

  for (const drug of DRUGS) {
    try {
      const item = await fetchLabel(drug);
      if (item) items.push(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[download-fda-snapshot] failed for ${drug}: ${message}`);
    }
  }

  const payload = {
    version: '2026-03-14',
    notes: 'Compact FDA label snapshot used when live API is unavailable or rate-limited.',
    items
  };

  await fs.writeFile(
    new URL('../data/fdaKnowledgeSnapshot.json', import.meta.url),
    JSON.stringify(payload, null, 2),
    'utf8'
  );

  console.log(`[download-fda-snapshot] wrote ${items.length} items`);
}

run();
