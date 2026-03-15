import { tokenize, scoreRelevance, selectTopK, ContextRecord } from '../lib/contextSelector';

describe('contextSelector', () => {
  describe('tokenize', () => {
    it('splits query into lowercase tokens > 2 chars', () => {
      expect(tokenize('What is the Diagnosis?')).toEqual(['what', 'the', 'diagnosis']);
    });

    it('removes short tokens', () => {
      expect(tokenize('a b cd efg')).toEqual(['efg']);
    });

    it('handles empty string', () => {
      expect(tokenize('')).toEqual([]);
    });
  });

  describe('scoreRelevance', () => {
    it('counts matching tokens', () => {
      expect(scoreRelevance('Patient has headache and fever', ['headache', 'fever', 'nausea'])).toBe(2);
    });

    it('is case-insensitive', () => {
      expect(scoreRelevance('HEADACHE', ['headache'])).toBe(1);
    });

    it('returns 0 when no match', () => {
      expect(scoreRelevance('nothing here', ['medication'])).toBe(0);
    });
  });

  describe('selectTopK', () => {
    const records: ContextRecord[] = [
      { id: 'r1', text: 'Symptoms: headache, fever. Diagnosis: flu', created_at: '2025-01-01' },
      { id: 'r2', text: 'Medication: paracetamol 500mg twice daily', created_at: '2025-01-02' },
      { id: 'r3', text: 'Follow-up notes: patient improving', created_at: '2025-01-03' },
      { id: 'r4', text: '', created_at: '2025-01-04' },
    ];

    it('ranks records by relevance to query', () => {
      const result = selectTopK(records, 'What medication was prescribed?', 5000);
      expect(result.selected[0].id).toBe('r2');
    });

    it('excludes empty records', () => {
      const result = selectTopK(records, 'anything', 5000);
      expect(result.selected.find((r) => r.id === 'r4')).toBeUndefined();
    });

    it('respects maxChars limit', () => {
      const result = selectTopK(records, 'headache medication notes', 80);
      expect(result.context.length).toBeLessThanOrEqual(80 + 200);
      expect(result.selected.length).toBeLessThan(records.length);
    });

    it('returns empty when all records are empty', () => {
      const empty: ContextRecord[] = [{ id: 'e1', text: '', created_at: '2025-01-01' }];
      const result = selectTopK(empty, 'test', 5000);
      expect(result.selected).toEqual([]);
      expect(result.context).toBe('');
    });
  });
});
