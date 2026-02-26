'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { Appointment } from '@/types';
import QrCheckIn from './QrCheckIn';

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel: (id: string) => void;
  cancelling: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  BOOKED:    { label: 'Confirmé',  color: 'bg-blue-100 text-blue-700' },
  CANCELLED: { label: 'Annulé',    color: 'bg-red-100 text-red-700' },
  ARRIVED:   { label: 'Arrivé',    color: 'bg-green-100 text-green-700' },
  NO_SHOW:   { label: 'Absent',    color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Terminé',   color: 'bg-gray-100 text-gray-700' },
};

export default function AppointmentCard({ appointment, onCancel, cancelling }: AppointmentCardProps) {
  const status = statusConfig[appointment.status] || {
    label: appointment.status,
    color: 'bg-gray-100 text-gray-700',
  };

  const startTime = new Date(appointment.start_datetime);
  const isUpcoming = appointment.status === 'BOOKED' && startTime > new Date();
  const qrData = `checkin:${appointment.id}:${appointment.qr_token}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg text-gray-800">{appointment.doctor_name}</h3>
          <p className="text-sm text-primary-600">{appointment.specialty}</p>
          <p className="text-sm text-gray-500">{appointment.clinic_name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Date & Time */}
      <div className="border-t pt-4 space-y-1">
        <p className="text-sm text-gray-600">
          📅{' '}
          {startTime.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p className="text-sm text-gray-600">
          🕐{' '}
          {startTime.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Upcoming: QR + Cancel + Check-in */}
      {isUpcoming && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-lg border-2 border-dashed border-gray-200">
              <QRCodeSVG value={qrData} size={140} />
            </div>
          </div>
          <p className="text-xs text-center text-gray-400">
            Présentez ce QR code lors de votre arrivée
          </p>

          {/* Check-in button */}
          <QrCheckIn appointmentId={appointment.id} qrToken={appointment.qr_token} />

          {/* Cancel button */}
          <button
            onClick={() => onCancel(appointment.id)}
            disabled={cancelling}
            className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium"
          >
            {cancelling ? 'Annulation...' : 'Annuler le rendez-vous'}
          </button>
        </div>
      )}

      {/* Arrived: show check-in time */}
      {appointment.status === 'ARRIVED' && appointment.checkin_at && (
        <div className="mt-4 border-t pt-4 text-center">
          <p className="text-green-600 font-medium text-sm">
            ✅ Arrivé à{' '}
            {new Date(appointment.checkin_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      )}
    </div>
  );
}
