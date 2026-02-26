'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import type { Doctor } from '@/types';

export default function DoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    api
      .get('/doctors')
      .then(setDoctors)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Nos Médecins</h1>
        <p className="text-gray-500 mb-6">Choisissez un médecin pour consulter ses créneaux</p>

        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600 mx-auto" />
            <p className="text-gray-400 mt-4">Chargement...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && doctors.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🩺</p>
            <p>Aucun médecin disponible pour le moment.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              onClick={() => router.push(`/doctors/${doc.id}/schedule`)}
              className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md hover:border-primary-200 transition cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-primary-50 text-primary-600 rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold shrink-0">
                  {doc.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold group-hover:text-primary-600 transition">
                    {doc.full_name}
                  </h2>
                  <p className="text-sm text-primary-600 font-medium">{doc.specialty}</p>
                  <p className="text-sm text-gray-500 mt-1">📍 {doc.clinic_name}</p>
                  {doc.bio && (
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2">{doc.bio}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 text-right">
                <span className="text-xs text-primary-500 group-hover:text-primary-700 font-medium transition">
                  Voir les créneaux →
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
