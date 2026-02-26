'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      const user = getUser();
      if (user?.role === 'DOCTOR') {
        router.replace('/doctor/dashboard');
      } else {
        router.replace('/doctors');
      }
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
    </div>
  );
}
