'use client';

import dynamic from 'next/dynamic';

const OwlCursor = dynamic(() => import('./OwlCursor'), { ssr: false });

export default function OwlCursorWrapper() {
  return <OwlCursor />;
}
