'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import Navbar from '@/components/Navbar';

interface DoctorAppointment {
  id: string;
  status: 'BOOKED' | 'CANCELLED' | 'ARRIVED' | 'NO_SHOW' | 'COMPLETED';
  type: 'SCHEDULED' | 'WALK_IN';
  checkin_at: string | null;
  qr_token: string;
  created_at: string;
  start_datetime: string;
  end_datetime: string;
  patient_name: string;
  patient_code: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  BOOKED:    { label: 'Confirmé',  color: 'text-blue-700',   bg: 'bg-blue-100' },
  ARRIVED:   { label: 'Arrivé',    color: 'text-green-700',  bg: 'bg-green-100' },
  NO_SHOW:   { label: 'Absent',    color: 'text-amber-700',  bg: 'bg-amber-100' },
  COMPLETED: { label: 'Terminé',   color: 'text-gray-700',   bg: 'bg-gray-100' },
  CANCELLED: { label: 'Annulé',    color: 'text-red-700',    bg: 'bg-red-100' },
};

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/doctor/login');
      return;
    }
    const user = getUser();
    if (user?.role !== 'DOCTOR') {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);

  async function loadAppointments() {
    setLoading(true);
    try {
      const data = await api.get(`/doctor/appointments?date=${selectedDate}`);
      setAppointments(data);
    } catch (err) {
      console.error('[Dashboard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(appointmentId: string, newStatus: string) {
    setUpdating(appointmentId);
    try {
      await api.patch(`/doctor/appointments/${appointmentId}/status`, { status: newStatus });
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    } finally {
      setUpdating(null);
    }
  }

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  // Stats
  const stats = {
    total: appointments.filter((a) => a.status !== 'CANCELLED').length,
    arrived: appointments.filter((a) => a.status === 'ARRIVED').length,
    waiting: appointments.filter((a) => a.status === 'BOOKED').length,
    noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
  };

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tableau de Bord</h1>
            <p className="text-gray-500">Vue d'ensemble de vos rendez-vous</p>
          </div>
          <button
            onClick={() => router.push('/doctor/availability')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            ⚙️ Gérer l'emploi du temps
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-indigo-600">{stats.total}</p>
            <p className="text-xs text-gray-500">Total du jour</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.waiting}</p>
            <p className="text-xs text-gray-500">En attente</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.arrived}</p>
            <p className="text-xs text-gray-500">Arrivés</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.noShow}</p>
            <p className="text-xs text-gray-500">Absents</p>
          </div>
        </div>

        {/* Date picker */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {dates.map((dateStr) => {
            const isSelected = dateStr === selectedDate;
            const d = new Date(dateStr + 'T00:00:00');
            const isToday =
              dateStr === new Date().toISOString().split('T')[0];

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                  flex flex-col items-center min-w-[80px] py-3 px-3 rounded-xl border-2 transition text-sm
                  ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200'
                  }
                `}
              >
                <span className="text-xs font-medium">
                  {isToday
                    ? "Aujourd'hui"
                    : d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </span>
                <span className="text-lg font-bold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* Appointments list */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 mx-auto" />
            <p className="text-gray-400 mt-4">Chargement...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">Aucun rendez-vous pour cette date</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Heure
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {appointments.map((apt) => {
                  const time = new Date(apt.start_datetime).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const status = statusConfig[apt.status] || statusConfig.BOOKED;
                  const isActive = apt.status === 'BOOKED' || apt.status === 'ARRIVED';

                  return (
                    <tr
                      key={apt.id}
                      className={`hover:bg-gray-50 transition ${
                        apt.status === 'ARRIVED' ? 'bg-green-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-800">{time}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{apt.patient_name}</div>
                        {apt.patient_code && (
                          <span className="text-xs text-gray-400">{apt.patient_code}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            apt.type === 'WALK_IN'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {apt.type === 'WALK_IN' ? 'Sans RDV' : 'RDV'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                        {apt.checkin_at && (
                          <span className="block text-xs text-gray-400 mt-1">
                            ✅{' '}
                            {new Date(apt.checkin_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isActive && (
                          <div className="flex gap-1">
                            {apt.status === 'BOOKED' && (
                              <button
                                onClick={() => updateStatus(apt.id, 'NO_SHOW')}
                                disabled={updating === apt.id}
                                className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 transition"
                              >
                                Absent
                              </button>
                            )}
                            {apt.status === 'ARRIVED' && (
                              <button
                                onClick={() => updateStatus(apt.id, 'COMPLETED')}
                                disabled={updating === apt.id}
                                className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition"
                              >
                                Terminé
                              </button>
                            )}
                            <button
                              onClick={() => updateStatus(apt.id, 'CANCELLED')}
                              disabled={updating === apt.id}
                              className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100 transition"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
