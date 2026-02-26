'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearAuth, isAuthenticated, getUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    const user = getUser();
    if (user) {
      setUserName(user.full_name || '');
      setRole(user.role || '');
    }
  }, []);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  const isDoctor = role === 'DOCTOR';

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={isDoctor ? '/doctor/dashboard' : '/'} className="text-xl font-bold text-primary-600 flex items-center gap-2">
          <span className="text-2xl">🏥</span>
          <span>TabibNet</span>
          {isDoctor && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Médecin</span>}
        </Link>

        {loggedIn && (
          <div className="flex items-center gap-6">
            {isDoctor ? (
              <>
                <Link
                  href="/doctor/dashboard"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  Tableau de bord
                </Link>
                <Link
                  href="/doctor/availability"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  Emploi du temps
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/doctors"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  Médecins
                </Link>
                <Link
                  href="/my-appointments"
                  className="text-sm text-gray-600 hover:text-primary-600 transition"
                >
                  Mes RDV
                </Link>
              </>
            )}
            <div className="flex items-center gap-3 pl-4 border-l">
              <span className="text-xs text-gray-400">{userName}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700 transition"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
