'use client';

import {Tooltip, TooltipContent, TooltipTrigger} from '../shadcn/tooltip';
import clsx from 'clsx';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

export function NavItem({href, label, children, isDrawerOpen}: {
    href: string;
    label: string;
    children: React.ReactNode;
    isDrawerOpen?: boolean;
}) {
    const pathname = usePathname();

    return (
        <div className="flex items-center w-full">
            {/* Tooltip only for collapsed state */}
            {!isDrawerOpen ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link
                            href={href}
                            className={clsx(
                                'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground',
                                {
                                    'bg-accent text-black': pathname === href,
                                }
                            )}
                        >
                            {children}
                            <span className="sr-only">{label}</span>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
            ) : (
                <Link
                    href={href}
                    className={clsx(
                        'flex items-center w-full gap-4 px-2 py-2 rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        {
                            'bg-accent text-black': pathname === href,
                        }
                    )}
                >
                    {children}
                    <span className="text-base font-medium">{label}</span>
                </Link>
            )}
        </div>
    );
}
