'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

export default function DoctorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/doctor/login', { email, password });
      setToken(res.token);
      setUser(res.user);
      router.push('/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-700 flex items-center justify-center gap-3">
            <span className="text-5xl">🩺</span>
            TabibNet
          </h1>
          <p className="text-gray-500 mt-2">Espace Médecin</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleLogin}>
            <h2 className="text-xl font-semibold mb-6 text-center">Connexion Médecin</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@tabib.dz"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Demo info */}
          <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
            <p className="text-xs text-indigo-600 font-medium mb-1">🔑 Compte démo</p>
            <p className="text-sm text-indigo-700 font-mono">doctor@tabib.dz / doctor123</p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/login" className="text-sm text-gray-500 hover:text-indigo-600 transition">
            ← Espace Patient
          </a>
        </div>
      </div>
    </div>
  );
}
