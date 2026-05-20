'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0d] text-white">
      <div className="animate-pulse text-neutral-400 font-medium">Redirigiendo a HAIR STYLE...</div>
    </div>
  );
}
