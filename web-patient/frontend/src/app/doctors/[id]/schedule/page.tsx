'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import SlotGrid from '@/components/SlotGrid';
import type { Doctor, Slot } from '@/types';

export default function SchedulePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const doctorId = params.id;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Generate next 7 days for date picker
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    api
      .get(`/doctors/${doctorId}`)
      .then(setDoctor)
      .catch(console.error);
  }, [doctorId, router]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    setSuccessMsg('');
    api
      .get(`/doctors/${doctorId}/slots?from=${selectedDate}&to=${selectedDate}`)
      .then(setSlots)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [doctorId, selectedDate]);

  async function handleBook(slotId: string) {
    if (booking) return;
    setBooking(true);
    setSuccessMsg('');

    try {
      await api.post('/appointments', { doctor_id: doctorId, slot_id: slotId });

      // Refresh slots
      const updatedSlots = await api.get(
        `/doctors/${doctorId}/slots?from=${selectedDate}&to=${selectedDate}`
      );
      setSlots(updatedSlots);
      setSuccessMsg('✅ Rendez-vous réservé avec succès !');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la réservation');
    } finally {
      setBooking(false);
    }
  }

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.getTime() === today.getTime()) return "Aujourd'hui";
    if (d.getTime() === tomorrow.getTime()) return 'Demain';

    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto p-6">
        {/* Doctor info */}
        {doctor && (
          <div className="mb-6">
            <button
              onClick={() => router.push('/doctors')}
              className="text-sm text-gray-500 hover:text-primary-600 transition mb-3 inline-block"
            >
              ← Retour aux médecins
            </button>
            <h1 className="text-2xl font-bold">{doctor.full_name}</h1>
            <p className="text-primary-600 font-medium">{doctor.specialty}</p>
            <p className="text-gray-500">📍 {doctor.clinic_name}</p>
          </div>
        )}

        {/* Date picker */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Choisir une date</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((dateStr) => {
              const isSelected = dateStr === selectedDate;
              const d = new Date(dateStr + 'T00:00:00');
              const dayNum = d.getDate();
              const dayName = formatDateLabel(dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`
                    flex flex-col items-center min-w-[80px] py-3 px-3 rounded-xl border-2 transition text-sm
                    ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200'
                    }
                  `}
                >
                  <span className="text-xs font-medium">{dayName}</span>
                  <span className="text-lg font-bold">{dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium text-center">
            {successMsg}
            <button
              onClick={() => router.push('/my-appointments')}
              className="ml-3 underline text-green-600 hover:text-green-800"
            >
              Voir mes rendez-vous
            </button>
          </div>
        )}

        {/* Slots */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Créneaux disponibles — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto" />
              <p className="text-gray-400 mt-3 text-sm">Chargement des créneaux...</p>
            </div>
          ) : (
            <SlotGrid slots={slots} onBook={handleBook} booking={booking} />
          )}
        </div>
      </main>
    </>
  );
}
