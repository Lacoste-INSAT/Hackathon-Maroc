'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import Navbar from '@/components/Navbar';

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
];

const DURATIONS = [15, 20, 30, 45, 60];

interface Rule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

export default function AvailabilityPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [genFrom, setGenFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [genTo, setGenTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/doctor/login');
      return;
    }
    const user = getUser();
    if (user?.role !== 'DOCTOR') {
      router.push('/login');
      return;
    }
    // Load existing rules
    api.get('/doctor/availability')
      .then((data: Rule[]) => {
        if (data.length > 0) setRules(data);
      })
      .catch(console.error);
  }, [router]);

  function addRule() {
    setRules([
      ...rules,
      { day_of_week: 1, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 20 },
    ]);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, field: keyof Rule, value: any) {
    const updated = [...rules];
    (updated[index] as any)[field] = value;
    setRules(updated);
  }

  async function handleSave() {
    if (rules.length === 0) {
      setError('Ajoutez au moins une règle de disponibilité');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await api.post('/doctor/availability', { rules });
      setMessage(`✅ ${res.count} règle(s) enregistrée(s)`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage('');
    setError('');

    try {
      const res = await api.post(`/doctor/slots/generate?from=${genFrom}&to=${genTo}`);
      setMessage(`✅ ${res.count} créneau(x) généré(s) du ${genFrom} au ${genTo}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  }

  function addPreset(preset: 'morning' | 'afternoon' | 'fullday') {
    const newRules: Rule[] = [];
    const workDays = [1, 2, 3, 4, 5];

    for (const day of workDays) {
      if (preset === 'morning' || preset === 'fullday') {
        newRules.push({ day_of_week: day, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 20 });
      }
      if (preset === 'afternoon' || preset === 'fullday') {
        newRules.push({ day_of_week: day, start_time: '14:00', end_time: '17:00', slot_duration_minutes: 20 });
      }
    }

    setRules(newRules);
    setMessage('');
    setError('');
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Emploi du Temps</h1>
        <p className="text-gray-500 mb-6">
          Définissez vos créneaux de disponibilité, puis générez les slots pour les patients
        </p>

        {/* Feedback */}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: Availability Rules ────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">1. Règles de disponibilité</h2>
            <div className="flex gap-2">
              <button
                onClick={() => addPreset('morning')}
                className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition"
              >
                Matin seul
              </button>
              <button
                onClick={() => addPreset('afternoon')}
                className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition"
              >
                Après-midi seul
              </button>
              <button
                onClick={() => addPreset('fullday')}
                className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"
              >
                Journée complète
              </button>
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p className="mb-4">Aucune règle définie. Utilisez les presets ou ajoutez manuellement.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                >
                  {/* Jour */}
                  <select
                    value={rule.day_of_week}
                    onChange={(e) => updateRule(i, 'day_of_week', parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>

                  {/* Start time */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">De</span>
                    <input
                      type="time"
                      value={rule.start_time}
                      onChange={(e) => updateRule(i, 'start_time', e.target.value)}
                      className="px-2 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>

                  {/* End time */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">À</span>
                    <input
                      type="time"
                      value={rule.end_time}
                      onChange={(e) => updateRule(i, 'end_time', e.target.value)}
                      className="px-2 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>

                  {/* Duration */}
                  <select
                    value={rule.slot_duration_minutes}
                    onChange={(e) => updateRule(i, 'slot_duration_minutes', parseInt(e.target.value))}
                    className="px-2 py-2 border rounded-lg text-sm bg-white"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>

                  {/* Remove */}
                  <button
                    onClick={() => removeRule(i)}
                    className="text-red-400 hover:text-red-600 transition text-lg ml-auto"
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={addRule}
              className="px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary-400 hover:text-primary-600 transition"
            >
              + Ajouter une règle
            </button>

            <button
              onClick={handleSave}
              disabled={saving || rules.length === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 ml-auto"
            >
              {saving ? 'Enregistrement...' : '💾 Enregistrer les règles'}
            </button>
          </div>
        </div>

        {/* ── Step 2: Generate Slots ────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">2. Générer les créneaux</h2>
          <p className="text-sm text-gray-500 mb-4">
            Une fois les règles enregistrées, générez les créneaux pour que les patients puissent réserver.
          </p>

          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Du</label>
              <input
                type="date"
                value={genFrom}
                onChange={(e) => setGenFrom(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Au</label>
              <input
                type="date"
                value={genTo}
                onChange={(e) => setGenTo(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {generating ? 'Génération...' : '⚡ Générer les créneaux'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
