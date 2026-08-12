'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  BotMessageSquare,
  BrainCircuit,
  BrainCog,
  ChartNetwork,
  CircleHelp,
  CircleUserRound,
  Menu,
  MessagesSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Radar,
  RadioTower,
  Router,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  TabletSmartphone,
  Target,
  UserRoundCog,
  Workflow,
  X,
} from 'lucide-react';
import type { IconType } from 'react-icons';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { useAgencyTheme } from '@/app/providers';
import {
  AssistantPageContextProvider,
  useAssistantPageContextMetadata,
} from '@/components/assistant/AssistantPageContext';
import ConversationWorkspace from '@/components/conversations/ConversationWorkspace';
import { Badge } from '@/components/library/shadcn/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/library/shadcn/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/library/shadcn/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import UserAvatar from '@/components/navbar/UserAvatar';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { assistantOpenEvent } from '@/lib/assistant/events';
import { physicalDevicesApi } from '@/lib/api/backend/physicalDevices';
import { smartHomeApi } from '@/lib/api/backend/smartHome';
import { useAgencyUserPreferences } from '@/lib/userPreferences';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { cn } from '@/lib/utils';

import BackendHealthIndicator from './BackendHealthIndicator';
import CommandPalette from './CommandPalette';
import { rememberWorkspaceItem } from '@/lib/workspaceHistory';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }> | IconType;
  description: string;
  tone:
    | 'agent'
    | 'assistant'
    | 'graph'
    | 'help'
    | 'integration'
    | 'memory'
    | 'model'
    | 'monitor'
    | 'operator'
    | 'persona'
    | 'profile'
    | 'run'
    | 'workflow';
  badge?: string;
  requiresDiagnosticsOptIn?: boolean;
  requiresPhysicalDevices?: boolean;
  requiresSmartHome?: boolean;
  requiresDeviceOperations?: boolean;
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
        tone: 'workflow',
      },
      {
        name: 'Agents',
        path: '/agents',
        icon: Bot,
        description: 'Canonical agent definitions',
        tone: 'agent',
      },
      {
        name: 'Operators',
        path: '/operators',
        icon: RadioTower,
        description: 'Persistent governed responsibility owners',
        tone: 'operator',
      },
      {
        name: 'Goals',
        path: '/goals',
        icon: Target,
        description: 'Durable objectives and supervision',
        tone: 'operator',
      },
      {
        name: 'Persona',
        path: '/persona',
        icon: UserRoundCog,
        description: 'Distill reusable identity and expertise',
        tone: 'persona',
      },
      {
        name: 'Runs',
        path: '/runs',
        icon: Activity,
        description: 'Live runs and execution history',
        tone: 'run',
      },
      {
        name: 'Models',
        path: '/models',
        icon: BrainCog,
        description: 'LLM connections and profiles',
        tone: 'model',
      },
      {
        name: 'Integrations',
        path: '/integrations',
        icon: Plug,
        description: 'Connect models, MCP servers, and services',
        tone: 'integration',
      },
      {
        name: 'Assistant',
        path: '/assistant',
        icon: MessagesSquare,
        description: 'Ask the Main Agent for help and approvals',
        tone: 'assistant',
      },
      {
        name: 'Agency Graph',
        path: '/memory-graph',
        icon: ChartNetwork,
        description: 'Operations and knowledge graph',
        tone: 'graph',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        name: 'Profile',
        path: '/profile',
        icon: CircleUserRound,
        description: 'Identity, session, and API tokens',
        tone: 'profile',
      },
      {
        name: 'FAQ',
        path: '/help/faq',
        icon: CircleHelp,
        description: 'Essential answers for using this install',
        tone: 'help',
      },
    ],
  },
  {
    title: 'Setup',
    items: [
      {
        name: 'Smart Home',
        path: '/integrations/smart-home',
        icon: Plug,
        description: 'Connect and verify home devices',
        tone: 'integration',
        requiresSmartHome: true,
      },
      {
        name: 'Physical Devices',
        path: '/operations/physical-devices',
        icon: Router,
        description: 'Enable audited device operations',
        tone: 'monitor',
        requiresPhysicalDevices: true,
      },
    ],
  },
  {
    title: 'Advanced',
    items: [
      {
        name: 'Memory Ops',
        path: '/operations/memory',
        icon: BrainCircuit,
        description: 'Memory inspection and controls',
        tone: 'memory',
      },
      {
        name: 'Monitor',
        path: '/operations/main-agent-monitor',
        icon: Radar,
        description: 'Main-agent workflow supervision',
        tone: 'monitor',
      },
      {
        name: 'Diagnostics',
        path: '/operations/diagnostics',
        icon: Stethoscope,
        description: 'System health and observability',
        tone: 'run',
        requiresDiagnosticsOptIn: true,
      },
      {
        name: 'Devices',
        path: '/operations/devices',
        icon: TabletSmartphone,
        description: 'Smart Home and physical device operations',
        tone: 'integration',
        requiresDeviceOperations: true,
      },
    ],
  },
];

function isNavItemActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function useVisibleNavSections() {
  const {
    preferences: { showDiagnostics },
  } = useAgencyUserPreferences();
  const physicalDevicesAvailabilityQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDevicesAvailability(),
    queryFn: () => physicalDevicesApi.getAvailability(),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const smartHomeAvailabilityQuery = useQuery({
    queryKey: queryKeys.backendSmartHomeAvailability(),
    queryFn: () => smartHomeApi.getAvailability(),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const physicalDevicesAvailable = physicalDevicesAvailabilityQuery.data?.available === true;
  const smartHomeAvailable = smartHomeAvailabilityQuery.data?.available === true;
  const deviceOperationsAvailable = physicalDevicesAvailable || smartHomeAvailable;

  return useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              (!item.requiresDiagnosticsOptIn || showDiagnostics) &&
              (!item.requiresPhysicalDevices || physicalDevicesAvailable) &&
              (!item.requiresSmartHome || smartHomeAvailable) &&
              (!item.requiresDeviceOperations || deviceOperationsAvailable)
          ),
        }))
        .filter((section) => section.items.length > 0),
    [deviceOperationsAvailable, physicalDevicesAvailable, showDiagnostics, smartHomeAvailable]
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Image src="/images/open-agency.svg" alt="Open Agency" width={32} height={32} priority />
      {compact ? null : (
        <span className="text-[1.05rem] font-semibold tracking-[-0.025em] text-(--agency-shell-text)">
          Open Agency
        </span>
      )}
    </Link>
  );
}

function NavigationItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isActive = isNavItemActive(pathname, item.path);

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.path}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            data-tone={item.tone}
            className={cn(
              'agency-nav-item group relative flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-[0.94rem] font-medium text-(--agency-shell-muted) outline-none transition-colors',
              'hover:bg-(--agency-row-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring',
              isActive && 'bg-(--agency-active-bg) text-(--agency-shell-text)'
            )}
          >
            {isActive ? (
              <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-(--agency-nav-tone)" />
            ) : null}
            <span className="agency-nav-icon flex size-7 shrink-0 items-center justify-center rounded-md">
              <Icon className="size-[1.05rem] stroke-[1.75]" />
            </span>
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const visibleNavSections = useVisibleNavSections();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] shrink-0 items-center border-b border-(--agency-shell-border) px-5">
        <Logo />
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-5"
        aria-label="Primary"
      >
        {visibleNavSections.map((section) => (
          <section key={section.title} className="flex flex-col gap-1">
            <h2 className="px-3 pb-1.5 text-[0.67rem] font-semibold uppercase tracking-[0.14em] text-(--agency-shell-muted)">
              {section.title}
            </h2>
            {section.items.map((item) => (
              <NavigationItem key={item.path} item={item} onNavigate={onNavigate} />
            ))}
          </section>
        ))}
      </nav>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-lg border border-(--agency-control-border) bg-(--agency-control-bg) text-(--agency-shell-muted) shadow-(--agency-outline-shadow) outline-none transition-colors',
              'hover:bg-(--agency-control-bg-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useAgencyTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="group inline-flex h-9 items-center rounded-full border border-(--agency-control-border) bg-(--agency-control-bg) p-0.5 shadow-(--agency-outline-shadow) outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-full transition-colors',
          !isDark && 'bg-background text-primary shadow-sm'
        )}
      >
        <Sun className="size-4 stroke-[1.75]" />
      </span>
      <span
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-full transition-colors',
          isDark && 'bg-accent text-foreground shadow-sm'
        )}
      >
        <Moon className="size-4 stroke-[1.75]" />
      </span>
    </button>
  );
}

function AssistantGlyph({
  label,
  icon,
  className = 'size-5',
}: {
  label: string;
  icon: 'bot' | 'sparkles' | 'initial';
  className?: string;
}) {
  if (icon === 'sparkles') {
    return <Sparkles className={cn(className, 'stroke-[1.75]')} aria-hidden="true" />;
  }
  if (icon === 'initial') {
    return (
      <span className="text-sm font-semibold" aria-hidden="true">
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <BotMessageSquare className={cn(className, 'stroke-[1.75]')} aria-hidden="true" />;
}

function AssistantLauncher({
  label,
  mode,
  icon,
  onOpen,
}: {
  label: string;
  mode: 'floating' | 'dock' | 'hidden';
  icon: 'bot' | 'sparkles' | 'initial';
  onOpen: () => void;
}) {
  const pathname = usePathname();
  if (pathname === '/assistant' || mode === 'hidden') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${label}`}
      title={`Open ${label}`}
      data-placement={mode}
      className={cn(
        'group fixed z-20 hidden items-center justify-center bg-background p-[2px] shadow-(--agency-elevation-2) outline-none motion-reduce:transition-none motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex',
        mode === 'floating'
          ? 'bottom-4 right-4 size-12 rounded-full transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6 sm:size-13'
          : 'bottom-20 right-0 h-12 w-10 rounded-l-2xl border border-r-0 border-(--agency-shell-border) transition-[width] hover:w-12 focus-visible:w-12 sm:bottom-24'
      )}
    >
      <span
        className={cn(
          'agency-gradient flex size-full items-center justify-center text-white',
          mode === 'floating' ? 'rounded-full' : 'rounded-l-[0.85rem]'
        )}
      >
        <span className="transition-transform group-hover:scale-105 motion-reduce:transform-none">
          <AssistantGlyph label={label} icon={icon} />
        </span>
      </span>
    </button>
  );
}

function CollapsedSidebar({ onExpand }: { onExpand: () => void }) {
  const pathname = usePathname();
  const visibleNavSections = useVisibleNavSections();

  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-[72px] w-full items-center justify-center border-b border-(--agency-shell-border)">
        <Logo compact />
      </div>
      <div className="flex w-full justify-center py-3">
        <IconButton label="Expand sidebar" onClick={onExpand}>
          <PanelLeftOpen className="size-4" />
        </IconButton>
      </div>
      <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pb-4">
        {visibleNavSections
          .flatMap((section) => section.items)
          .map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item.path);
            return (
              <TooltipProvider key={item.path} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.path}
                      aria-current={isActive ? 'page' : undefined}
                      data-tone={item.tone}
                      className={cn(
                        'agency-nav-item flex size-10 items-center justify-center rounded-lg text-(--agency-shell-muted) outline-none transition-colors hover:bg-(--agency-row-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring',
                        isActive && 'bg-(--agency-active-bg) text-primary'
                      )}
                    >
                      <Icon className="size-[1.1rem] stroke-[1.75]" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
      </nav>
      <div className="border-t border-(--agency-shell-border) py-3">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/observatory/builder"
                data-tone="graph"
                aria-label="Customize Observatory"
                className="agency-nav-item flex size-10 items-center justify-center rounded-lg text-(--agency-shell-muted) outline-none transition-colors hover:bg-(--agency-row-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SlidersHorizontal className="size-[1.1rem] stroke-[1.75]" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Customize Observatory</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function AppShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const getAssistantContextMetadata = useAssistantPageContextMetadata();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const {
    preferences: { assistantLauncherMode, assistantLauncherIcon },
  } = useAgencyUserPreferences();
  const visibleNavSections = useVisibleNavSections();
  const commandPaletteRoutes = useMemo(
    () => visibleNavSections.flatMap((section) => section.items),
    [visibleNavSections]
  );
  const { data: session } = useSession();
  const user = session?.user;
  const assistantDialogOpen = assistantOpen && pathname !== '/assistant';
  const mainAgentQuery = useQuery({
    queryKey: queryKeys.backendMainAgent(),
    queryFn: () => conversationsApi.getMainAgent(),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const assistantLabel = mainAgentQuery.data?.name?.trim() || 'Main Agent';

  useEffect(() => {
    const openAssistant = () => setAssistantOpen(true);
    window.addEventListener(assistantOpenEvent, openAssistant);
    return () => window.removeEventListener(assistantOpenEvent, openAssistant);
  }, []);

  useEffect(() => {
    const matchingRoute = commandPaletteRoutes
      .flatMap((item) => item)
      .sort((left, right) => right.path.length - left.path.length)
      .find((item) => isNavItemActive(pathname, item.path));
    if (!matchingRoute) {
      return;
    }

    rememberWorkspaceItem({
      path: pathname,
      label: matchingRoute.name,
      description:
        pathname === matchingRoute.path ? matchingRoute.description : `Open ${matchingRoute.name}`,
    });
  }, [commandPaletteRoutes, pathname]);

  return (
    <div className="h-dvh overflow-hidden bg-(--agency-shell-bg) text-(--agency-shell-text)">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[70] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring motion-reduce:transition-none"
      >
        Skip to main content
      </a>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          hideCloseButton
          className="w-[min(88vw,18rem)] max-w-none p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">Open Agency navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate between Open Agency workspace and account pages.
          </SheetDescription>
          <div className="relative h-full bg-(--agency-sidebar-bg) backdrop-blur-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
            <IconButton
              label="Close navigation menu"
              className="absolute right-4 top-[18px]"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </IconButton>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex h-full">
        <aside
          className={cn(
            'relative hidden h-full shrink-0 border-r border-(--agency-shell-border) bg-(--agency-sidebar-bg) backdrop-blur-xl transition-[width] duration-200 lg:block',
            desktopCollapsed ? 'w-[72px]' : 'w-[280px]'
          )}
        >
          {desktopCollapsed ? (
            <CollapsedSidebar onExpand={() => setDesktopCollapsed(false)} />
          ) : (
            <>
              <SidebarContent />
              <IconButton
                label="Collapse sidebar"
                onClick={() => setDesktopCollapsed(true)}
                className="absolute right-4 top-[18px]"
              >
                <PanelLeftClose className="size-4" />
              </IconButton>
            </>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-(--agency-shell-border) bg-(--agency-shell-panel) px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <IconButton label="Open navigation menu" onClick={() => setMobileOpen(true)}>
                  <Menu className="size-4" />
                </IconButton>
              </div>
              <div className="lg:hidden">
                <Logo />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <CommandPalette routes={commandPaletteRoutes} />
              <ThemeToggleButton />
              {pathname !== '/assistant' && assistantLauncherMode !== 'hidden' ? (
                <div className="sm:hidden">
                  <IconButton
                    label={`Open ${assistantLabel} assistant`}
                    onClick={() => setAssistantOpen(true)}
                  >
                    <AssistantGlyph
                      label={assistantLabel}
                      icon={assistantLauncherIcon}
                      className="size-4"
                    />
                  </IconButton>
                </div>
              ) : null}
              <div className="hidden sm:block">
                <BackendHealthIndicator compact showRefresh={false} />
              </div>
              <div className="hidden h-7 w-px bg-(--agency-shell-border) sm:block" />
              <div className="hidden items-center gap-2 sm:flex">
                <div className="max-w-36 text-right">
                  <p className="truncate text-sm font-medium text-(--agency-shell-text)">
                    {user?.name || 'Developer'}
                  </p>
                </div>
                <UserAvatar />
              </div>
              <div className="sm:hidden">
                <UserAvatar />
              </div>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="agency-workspace-background min-h-0 min-w-0 flex-1 overflow-y-auto bg-(--agency-shell-bg) outline-none"
          >
            <div className="mx-auto w-full max-w-[1520px] px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-8 xl:px-10">
              {children}
            </div>
          </main>
        </div>
      </div>

      <AssistantLauncher
        label={assistantLabel}
        mode={assistantLauncherMode}
        icon={assistantLauncherIcon}
        onOpen={() => setAssistantOpen(true)}
      />
      <Dialog open={assistantDialogOpen} onOpenChange={setAssistantOpen}>
        <DialogContent className="flex h-[min(85dvh,760px)] max-w-5xl flex-col overflow-hidden border-(--agency-shell-border) bg-(--agency-shell-panel-strong) p-0 text-(--agency-shell-text) shadow-2xl">
          <DialogTitle className="sr-only">Ask {assistantLabel}</DialogTitle>
          <DialogDescription className="sr-only">
            Popup assistant conversation window.
          </DialogDescription>
          <ConversationWorkspace
            mode="popup"
            contextMetadata={getAssistantContextMetadata}
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AssistantPageContextProvider>
      <AppShellChrome>{children}</AppShellChrome>
    </AssistantPageContextProvider>
  );
}
