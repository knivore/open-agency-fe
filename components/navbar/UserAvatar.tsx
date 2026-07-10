'use client';

import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { CircleUserRound, ExternalLink, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';

interface UserAvatarProps {
  isMobile?: boolean;
}

const userNavigation = [
  { name: 'Your Profile', href: '/profile' },
  {
    name: 'Observatory Builder',
    href: '/observatory/builder',
    openInNewTab: true,
  },
];

function Avatar({ size = 'default' }: { size?: 'default' | 'large' }) {
  const { data: session } = useSession();
  const user = session?.user;
  const sizeClass = size === 'large' ? 'size-10' : 'size-8';

  if (user?.image) {
    return (
      <Image
        src={user.image}
        alt={`${user.name || 'User'}'s profile`}
        width={40}
        height={40}
        className={cn(sizeClass, 'rounded-full object-cover')}
        priority
      />
    );
  }

  const initials = user?.name
    ?.split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className={cn(
        sizeClass,
        'inline-flex items-center justify-center rounded-full bg-(--agency-active-bg) text-xs font-semibold text-primary'
      )}
      aria-hidden="true"
    >
      {initials || <CircleUserRound className="size-5 stroke-[1.75]" />}
    </span>
  );
}

function MobileUserMenu() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="w-full text-(--agency-shell-text)">
      <div className="mb-4 flex items-center gap-3">
        <Avatar size="large" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user?.name || 'Guest User'}</p>
          <p className="truncate text-xs text-(--agency-shell-muted)">
            {user?.email || 'No email provided'}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {userNavigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            target={item.openInNewTab ? '_blank' : undefined}
            rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
            className="rounded-lg px-3 py-2 text-sm hover:bg-(--agency-row-hover)"
          >
            {item.name}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-lg px-3 py-2 text-left text-sm hover:bg-(--agency-row-hover)"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function DesktopUserMenu() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <Menu as="div" className="relative">
      <MenuButton className="flex rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <span className="sr-only">Open user menu</span>
        <Avatar />
      </MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-(--agency-shell-border) bg-(--agency-shell-panel-strong) p-1.5 text-(--agency-shell-text) shadow-xl backdrop-blur-xl focus:outline-none">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user?.name || 'Guest User'}</p>
            <p className="truncate text-xs text-(--agency-shell-muted)">
              {user?.email || 'No email provided'}
            </p>
          </div>

          <div className="h-px bg-(--agency-shell-border)" />
          <div className="py-1">
            {userNavigation.map((item) => (
              <MenuItem key={item.name}>
                {({ focus }) => (
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                      focus && 'bg-(--agency-row-hover)'
                    )}
                  >
                    {item.name}
                    {item.openInNewTab ? <ExternalLink className="size-3.5" /> : null}
                  </Link>
                )}
              </MenuItem>
            ))}
          </div>
          <div className="h-px bg-(--agency-shell-border)" />
          <div className="pt-1">
            <MenuItem>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                    focus && 'bg-(--agency-row-hover)'
                  )}
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              )}
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  );
}

export default function UserAvatar({ isMobile = false }: UserAvatarProps) {
  return isMobile ? <MobileUserMenu /> : <DesktopUserMenu />;
}
