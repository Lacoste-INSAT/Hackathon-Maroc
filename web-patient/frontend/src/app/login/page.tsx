'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState('');

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/otp/request', { phone });
      if (res.otp_code) setDebugOtp(res.otp_code);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/otp/verify', { phone, code: otp });
      setToken(res.token);
      setUser(res.user);
      router.push('/doctors');
    } catch (err: any) {
      setError(err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-700 flex items-center justify-center gap-3">
            <span className="text-5xl">🏥</span>
            TabibNet
          </h1>
          <p className="text-gray-500 mt-2">Votre portail de rendez-vous médical</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp}>
              <h2 className="text-xl font-semibold mb-6 text-center">Connexion</h2>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+213 555 100 001"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              />

              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <h2 className="text-xl font-semibold mb-2 text-center">Vérification</h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                Code envoyé au <strong>{phone}</strong>
              </p>

              {/* MVP: Show OTP for demo */}
              {debugOtp && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-center">
                  <p className="text-xs text-amber-600 font-medium">🔑 Code démo (MVP)</p>
                  <p className="text-2xl font-mono font-bold text-amber-700 tracking-widest">
                    {debugOtp}
                  </p>
                </div>
              )}

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code à 6 chiffres
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-center text-xl tracking-widest font-mono"
              />

              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full mt-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Vérifier'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setError(''); setDebugOtp(''); }}
                className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-primary-600 transition"
              >
                ← Changer de numéro
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6 space-y-2">
          <a href="/doctor/login" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition block">
            🩺 Espace Médecin
          </a>
          <p className="text-xs text-gray-400">
            TabibNet — Hackathon MVP · Données de démo
          </p>
        </div>
      </div>
    </div>
  );
}
