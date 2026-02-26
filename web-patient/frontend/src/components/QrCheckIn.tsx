'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface QrCheckInProps {
  appointmentId: string;
  qrToken: string;
}

export default function QrCheckIn({ appointmentId, qrToken }: QrCheckInProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleCheckIn() {
    setChecking(true);
    setResult(null);
    try {
      await api.post(`/appointments/${appointmentId}/checkin`, { qr_token: qrToken });
      setResult('success');
    } catch (err: any) {
      setResult('error');
      setErrorMsg(err.message || 'Erreur de check-in');
    } finally {
      setChecking(false);
    }
  }

  if (result === 'success') {
    return (
      <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
        <p className="text-green-700 font-medium">✅ Check-in effectué !</p>
        <p className="text-xs text-green-500 mt-1">Votre arrivée est enregistrée</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckIn}
        disabled={checking}
        className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
      >
        {checking ? 'Vérification...' : '📍 Check-in maintenant'}
      </button>
      {result === 'error' && (
        <p className="text-xs text-red-500 mt-1 text-center">{errorMsg}</p>
      )}
    </div>
  );
}
