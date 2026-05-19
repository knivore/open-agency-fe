'use client';

import React, { useMemo } from 'react';
import { LucideIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { IconType } from 'react-icons';

interface INavbarItem {
  name: string;
  icon: LucideIcon | IconType;
  path: string;
}

type NavbarItemProps = {
  item: INavbarItem;
};

const NavbarItem = ({ item }: NavbarItemProps) => {
  const Icon = item.icon;
  const { name, path } = item;

  const pathname = usePathname();
  const router = useRouter();

  const onClick = () => {
    router.push(path);
  };

  const isActive = useMemo(() => {
    return path === pathname;
  }, [path, pathname]);
  return (
    <>
      <div
        className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-neutral-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-950 ${
          isActive
            ? 'border-primary-200 bg-primary-50 text-primary-900 shadow-sm shadow-primary/10'
            : 'border-transparent'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center space-x-2">
          <Icon size={20} />
          <p className="text-sm font-semibold">{name}</p>
        </div>
      </div>
    </>
  );
};

export default NavbarItem;
