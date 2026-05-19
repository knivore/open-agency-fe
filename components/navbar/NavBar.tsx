'use client';
import React, { useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { LucideIcon, Workflow } from 'lucide-react';
import NavbarItem from './NavBarItem';
import { AiFillOpenAI } from 'react-icons/ai';
import { IconType } from 'react-icons';
import Image from 'next/image';
import Link from 'next/link';
import UserAvatar from './UserAvatar';
import { XMarkIcon } from '@heroicons/react/16/solid';

interface INavbarItem {
  name: string;
  icon: LucideIcon | IconType;
  path: string;
}

const items: INavbarItem[] = [
  {
    name: 'Workflows',
    path: '/workflows',
    icon: Workflow,
  },
  {
    name: 'Main Chat',
    path: '/assistant',
    icon: AiFillOpenAI,
  },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
      <Image
        src="/images/agency.svg"
        alt="Agency Logo"
        width={32}
        height={32}
        className="w-8 h-8"
        priority
      />
      <span className="agency-gradient-text text-2xl font-bold lg:text-3xl">agency</span>
    </Link>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Semi-transparent background overlay */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Menu panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm border-l border-primary-100 bg-white shadow-xl">
        <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Logo />
            <button
              type="button"
              className="rounded-lg border border-primary-100 p-2.5 text-neutral-700 hover:bg-primary-50"
              onClick={onClose}
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="mt-6 space-y-2">
            {items.map((item) => (
              <div key={item.path} onClick={onClose}>
                <NavbarItem item={item} />
              </div>
            ))}
          </div>

          {/* Mobile Avatar */}
          <div className="mt-auto border-t border-border pt-4">
            <UserAvatar isMobile={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

const NavBar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 h-[76px] border-b border-primary-100 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        {/* Logo - Visible on both mobile and desktop */}
        <div className="flex flex-1">
          <Logo />
        </div>

        {/* Desktop Navigation Items */}
        <div className="hidden lg:flex lg:gap-x-8">
          {items.map((item) => (
            <NavbarItem key={item.path} item={item} />
          ))}
        </div>

        {/* Desktop Avatar */}
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <UserAvatar />
        </div>

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-lg p-2.5 text-neutral-700 hover:bg-primary-50"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      </nav>
    </header>
  );
};

export default NavBar;
