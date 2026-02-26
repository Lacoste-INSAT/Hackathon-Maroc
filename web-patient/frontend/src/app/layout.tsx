import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TabibNet — Portail Patient',
  description: 'Réservez vos rendez-vous médicaux en ligne',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 min-h-screen text-gray-900">{children}</body>
    </html>
  );
}
