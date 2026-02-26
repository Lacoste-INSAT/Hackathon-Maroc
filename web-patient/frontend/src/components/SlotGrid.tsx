'use client';

import type { Slot } from '@/types';

interface SlotGridProps {
  slots: Slot[];
  onBook: (slotId: string) => void;
  booking: boolean;
}

export default function SlotGrid({ slots, onBook, booking }: SlotGridProps) {
  if (slots.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">📭</p>
        <p>Aucun créneau disponible pour cette date.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {slots.map((slot) => {
        const time = new Date(slot.start_datetime).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const isFree = slot.status === 'FREE';

        return (
          <button
            key={slot.id}
            disabled={!isFree || booking}
            onClick={() => {
              if (isFree && confirm(`Confirmer le rendez-vous à ${time} ?`)) {
                onBook(slot.id);
              }
            }}
            className={`
              slot-btn p-3 rounded-lg text-center text-sm font-medium border
              ${
                isFree
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-400 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }
            `}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}
