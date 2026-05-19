'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  Workflow,
  Bot,
  Activity,
  SlidersHorizontal,
  Cpu,
  Plug,
  MessageSquareText,
} from 'lucide-react';
import { IconType } from 'react-icons';
import BackendHealthIndicator from './BackendHealthIndicator';
import ConversationWorkspace from '@/components/conversations/ConversationWorkspace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/library/shadcn/dialog';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }> | IconType;
  description: string;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      {
        name: 'Workflows',
        path: '/workflows',
        icon: Workflow,
        description: 'Canonical workflows and execution',
      },
      {
        name: 'Agents',
        path: '/agents',
        icon: Bot,
        description: 'Canonical Agent definitions',
      },
      {
        name: 'Runs',
        path: '/runs',
        icon: Activity,
        description: 'Live runs and execution history',
      },
      {
        name: 'Runtime',
        path: '/runtime',
        icon: Cpu,
        description: 'Runtime adapters',
      },
      {
        name: 'LLM Models',
        path: '/behavior-profiles',
        icon: SlidersHorizontal,
        description: 'LLM connections and profiles',
      },
      {
        name: 'Integrations',
        path: '/integrations',
        icon: Plug,
        description: 'MCP servers, Tools, and Adapter',
      },
      {
        name: 'Assistant',
        path: '/assistant',
        icon: MessageSquareText,
        description: 'Main-agent chat and approvals',
      },
      {
        name: 'Observatory Builder',
        path: '/observatory/builder',
        icon: Wrench,
        description: 'Edit and publish pixel layouts',
        badge: 'Dev',
      },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 hover:opacity-90">
      <Image
        src="/images/agency.svg"
        alt="Agency Logo"
        width={36}
        height={36}
        className="h-9 w-9"
        priority
      />
      <div>
        <p className="agency-gradient-text text-lg font-semibold tracking-tight">Agency</p>
      </div>
    </Link>
  );
}

function NavigationItem({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const Icon = item.icon;
  const isActive = useMemo(() => pathname === item.path, [pathname, item.path]);

  return (
    <button
      type="button"
      onClick={() => {
        router.push(item.path);
        onClick?.();
      }}
      className={`group relative w-full overflow-hidden rounded-lg border px-3 py-3 text-left transition ${
        isActive
          ? 'border-primary-200 bg-white text-primary-950 shadow-sm shadow-primary/10'
          : 'border-transparent bg-transparent text-neutral-700 hover:border-primary-100 hover:bg-white/80 hover:text-neutral-950'
      }`}
    >
      {isActive ? (
        <span className="agency-gradient absolute inset-y-2 left-0 w-1 rounded-r-full" />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
              isActive
                ? 'agency-gradient text-white shadow-sm shadow-primary/20'
                : 'bg-primary-50 text-primary-800 group-hover:bg-primary-100'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="text-xs text-neutral-500">{item.description}</p>
          </div>
        </div>
        {item.badge ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            {item.badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <Logo />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {section.title}
            </p>
            <div className="mt-3 space-y-2">
              {section.items.map((item) => (
                <NavigationItem key={item.path} item={item} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantLauncher({ compact = false, onOpen }: { compact?: boolean; onOpen: () => void }) {
  const pathname = usePathname();
  const isAssistantRoute = pathname === '/assistant';

  if (isAssistantRoute) {
    return null;
  }

  if (compact) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-3 rounded-lg border border-primary-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50"
    >
      <span className="agency-gradient flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm shadow-primary/20">
        <MessageSquareText className="h-5 w-5" />
      </span>
      <span className="hidden sm:inline">Ask the assistant</span>
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistantDialogOpen = assistantOpen && pathname !== '/assistant';

  return (
    <div className="h-screen overflow-hidden agency-gradient-soft">
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto border-r border-primary-100 bg-white/95 shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex h-full">
        <aside
          className={`hidden h-full overflow-y-auto border-r border-primary-100 bg-white/85 backdrop-blur transition-all lg:block ${
            desktopCollapsed ? 'w-[96px]' : 'w-[320px]'
          }`}
        >
          {desktopCollapsed ? (
            <div className="flex h-full flex-col items-center gap-4 px-3 py-5">
              <button
                type="button"
                onClick={() => setDesktopCollapsed(false)}
                className="rounded-lg border border-primary-100 bg-white p-2 text-neutral-600 shadow-sm shadow-primary/5 hover:border-primary-300 hover:text-primary-900"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <Link
                href="/"
                className="rounded-lg border border-primary-100 bg-white p-3 shadow-sm shadow-primary/5"
              >
                <Image
                  src="/images/agency.svg"
                  alt="Agency Logo"
                  width={36}
                  height={36}
                  className="h-9 w-9"
                />
              </Link>
              <div className="mt-2 space-y-3">
                {navSections
                  .flatMap((section) => section.items)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
                          isActive
                            ? 'border-primary-200 bg-primary-50 text-primary-900 shadow-sm shadow-primary/10'
                            : 'border-transparent bg-white text-neutral-600 hover:border-primary-200 hover:text-primary-900'
                        }`}
                        title={item.name}
                      >
                        <Icon className="h-4 w-4" />
                      </Link>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setDesktopCollapsed(true)}
                className="absolute right-4 top-4 z-10 rounded-lg border border-primary-100 bg-white p-2 text-neutral-600 shadow-sm shadow-primary/5 hover:border-primary-300 hover:text-primary-900"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <SidebarContent />
            </div>
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 border-b border-primary-100 bg-white/85 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-primary-100 bg-white p-2 text-neutral-600 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <AssistantLauncher compact onOpen={() => setAssistantOpen(true)} />
                <BackendHealthIndicator compact />
              </div>
            </div>
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-transparent">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">{children}</div>
          </main>
        </div>
      </div>
      <AssistantLauncher onOpen={() => setAssistantOpen(true)} />
      <Dialog open={assistantDialogOpen} onOpenChange={setAssistantOpen}>
        <DialogContent
          className="flex h-[min(85vh,760px)] max-w-5xl flex-col overflow-hidden border border-primary-100 bg-white p-0 shadow-xl shadow-primary/10"
          hideCloseButton={false}
        >
          <DialogTitle className="sr-only">Ask the assistant</DialogTitle>
          <DialogDescription className="sr-only">
            Popup assistant conversation window.
          </DialogDescription>
          <ConversationWorkspace
            mode="popup"
            onOpenFullPage={() => {
              setAssistantOpen(false);
              router.push('/assistant');
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
