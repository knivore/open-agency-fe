'use client';

import Link from 'next/link';
import { UserCircle2 } from 'lucide-react';
import { localUser } from '@/lib/identity/localUser';

interface UserAvatarProps {
  isMobile?: boolean;
}

export default function UserAvatar({ isMobile = false }: UserAvatarProps) {
  const content = (
    <div className={`flex items-center gap-3 ${isMobile ? 'w-full' : ''}`}>
      <UserCircle2 className="h-10 w-10 text-primary-700" />
      <div className={isMobile ? 'min-w-0' : 'hidden'}>
        <p className="truncate text-sm font-medium text-gray-900">{localUser.name}</p>
        <p className="truncate text-sm text-gray-500">{localUser.email}</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Link
        href="/observatory/builder"
        className="block rounded-md px-2 py-2 hover:bg-primary-50"
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      href="/observatory/builder"
      className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      title="Observatory Builder"
    >
      {content}
    </Link>
  );
}
