'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import AppointmentCard from '@/components/AppointmentCard';
import type { Appointment } from '@/types';

export default function MyAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadAppointments();
  }, [router]);

  async function loadAppointments() {
    try {
      const data = await api.get('/appointments/me');
      setAppointments(data);
    } catch (err) {
      console.error('[MyAppointments] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Voulez-vous vraiment annuler ce rendez-vous ?')) return;
    setCancelling(true);
    try {
      await api.delete(`/appointments/${id}`);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'annulation");
    } finally {
      setCancelling(false);
    }
  }

  const upcoming = appointments.filter(
    (a) => a.status === 'BOOKED' && new Date(a.start_datetime) > new Date()
  );
  const past = appointments.filter(
    (a) => a.status !== 'BOOKED' || new Date(a.start_datetime) <= new Date()
  );

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Mes Rendez-vous</h1>
        <p className="text-gray-500 mb-6">Gérez vos rendez-vous et effectuez votre check-in</p>

        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600 mx-auto" />
            <p className="text-gray-400 mt-4">Chargement...</p>
          </div>
        )}

        {!loading && appointments.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-gray-500 text-lg mb-4">Aucun rendez-vous</p>
            <button
              onClick={() => router.push('/doctors')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
            >
              Prendre un rendez-vous
            </button>
          </div>
        )}

        {!loading && upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-primary-700 flex items-center gap-2">
              📅 À venir
              <span className="bg-primary-100 text-primary-600 text-xs px-2 py-1 rounded-full">
                {upcoming.length}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {upcoming.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  onCancel={handleCancel}
                  cancelling={cancelling}
                />
              ))}
            </div>
          </section>
        )}

        {!loading && past.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-gray-500 flex items-center gap-2">
              📋 Historique
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                {past.length}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {past.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  onCancel={handleCancel}
                  cancelling={cancelling}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
