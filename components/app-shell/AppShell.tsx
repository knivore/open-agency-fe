'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { useAgencyTheme } from '@/app/providers';
import {
  AssistantPageContextProvider,
  useAssistantPageContextMetadata,
} from '@/components/assistant/AssistantPageContext';
import ConversationWorkspace from '@/components/conversations/ConversationWorkspace';
import { Button } from '@/components/library/shadcn/button';
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
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiresDiagnosticsOptIn?: boolean;
  requiresPhysicalDevices?: boolean;
  requiresSmartHome?: boolean;
  requiresDeviceOperations?: boolean;
}

interface NavSection {
  title: string;
  description: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Build',
    description: 'Configure agents, workflows, models, and capabilities',
    items: [
      {
        name: 'Workflows',
        path: '/workflows',
        icon: Workflow,
        description: 'Design and run reusable workflows',
      },
      {
        name: 'Agents',
        path: '/agents',
        icon: Bot,
        description: 'Configure agents and their capabilities',
      },
      {
        name: 'Operators',
        path: '/operators',
        icon: RadioTower,
        description: 'Manage persistent responsibility owners',
      },
      {
        name: 'Goals',
        path: '/goals',
        icon: Target,
        description: 'Set durable objectives and supervision',
      },
      {
        name: 'Persona',
        path: '/persona',
        icon: UserRoundCog,
        description: 'Reuse identity and expertise',
      },
      {
        name: 'Models',
        path: '/models',
        icon: BrainCog,
        description: 'Manage model connections and profiles',
      },
      {
        name: 'Integrations',
        path: '/integrations',
        icon: Plug,
        description: 'Connect services and assign capabilities',
      },
      {
        name: 'Smart Home',
        path: '/integrations/smart-home',
        icon: Plug,
        description: 'Connect and verify home devices',
        requiresSmartHome: true,
      },
      {
        name: 'Physical Devices',
        path: '/operations/physical-devices',
        icon: Router,
        description: 'Enable audited device operations',
        requiresPhysicalDevices: true,
      },
    ],
  },
  {
    title: 'Operate',
    description: 'Follow execution and review human decisions',
    items: [
      {
        name: 'Runs',
        path: '/runs',
        icon: Activity,
        description: 'Inspect live runs and execution history',
      },
      {
        name: 'Monitor',
        path: '/operations/main-agent-monitor',
        icon: Radar,
        description: 'Review findings, approvals, and repository gates',
      },
      {
        name: 'Assistant',
        path: '/assistant',
        icon: MessagesSquare,
        description: 'Work with the Main Agent',
      },
      {
        name: 'Devices',
        path: '/operations/devices',
        icon: TabletSmartphone,
        description: 'Operate Smart Home and physical devices',
        requiresDeviceOperations: true,
      },
      {
        name: 'Diagnostics',
        path: '/operations/diagnostics',
        icon: Stethoscope,
        description: 'Inspect system health and observability',
        requiresDiagnosticsOptIn: true,
      },
    ],
  },
  {
    title: 'Knowledge',
    description: 'Explore agency context and inspect retained memory',
    items: [
      {
        name: 'Agency Graph',
        path: '/memory-graph',
        icon: ChartNetwork,
        description: 'Explore operations and knowledge relationships',
      },
      {
        name: 'Memory Ops',
        path: '/operations/memory',
        icon: BrainCircuit,
        description: 'Inspect memory, provenance, and controls',
      },
    ],
  },
  {
    title: 'Workspace',
    description: 'Manage your workspace and find guidance',
    items: [
      {
        name: 'Profile',
        path: '/profile',
        icon: CircleUserRound,
        description: 'Manage identity, session, and API tokens',
      },
      {
        name: 'FAQ',
        path: '/help/faq',
        icon: CircleHelp,
        description: 'Find answers and setup guidance',
      },
      {
        name: 'Customize Observatory',
        path: '/observatory/builder',
        icon: SlidersHorizontal,
        description: 'Edit the Observatory layout',
      },
      {
        name: 'Runtime',
        path: '/runtime',
        icon: Router,
        description: 'Inspect runtime adapters',
      },
      {
        name: 'Behavior profiles',
        path: '/behavior-profiles',
        icon: UserRoundCog,
        description: 'Configure reusable model behavior',
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

function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Image src="/images/open-agency.svg" alt="Open Agency" width={32} height={32} priority />
      <span
        className={cn(
          'text-[1.05rem] font-semibold tracking-[-0.025em]',
          inverted
            ? 'hidden text-(--agency-masthead-text) sm:inline lg:hidden xl:inline'
            : 'text-foreground'
        )}
      >
        Open Agency
      </span>
    </Link>
  );
}

/** Longest match prevents a nested destination from marking its parent current too. */
function currentDestination(sections: NavSection[], pathname: string) {
  return sections
    .flatMap((section) => section.items)
    .filter((item) => isNavItemActive(pathname, item.path))
    .sort((left, right) => right.path.length - left.path.length)[0];
}

function NavigationItem({
  item,
  current,
  onNavigate,
}: {
  item: NavItem;
  current?: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = current === item.path;
  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-accent font-semibold text-primary' : 'text-foreground'
      )}
    >
      <Icon className="size-4 shrink-0 stroke-[1.75]" aria-hidden="true" />
      <span>{item.name}</span>
    </Link>
  );
}

function NavigationDrawerContent({
  sections,
  current,
  onNavigate,
}: {
  sections: NavSection[];
  current?: string;
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <Logo />
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4"
        aria-label="All workspaces"
      >
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-1" aria-label={section.title}>
            <h2 className="px-3 text-sm font-semibold">{section.title}</h2>
            <p className="px-3 pb-2 text-xs leading-5 text-muted-foreground">
              {section.description}
            </p>
            {section.items.map((item) => (
              <NavigationItem
                key={item.path}
                item={item}
                current={current}
                onNavigate={onNavigate}
              />
            ))}
          </section>
        ))}
      </nav>
      <div className="border-t p-4">
        <ThemeToggleButton />
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  className,
  buttonRef,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            type="button"
            variant="outline"
            size="icon"
            onClick={onClick}
            aria-label={label}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-lg border border-(--agency-control-border) bg-(--agency-control-bg) text-(--agency-shell-muted) shadow-(--agency-outline-shadow) outline-none transition-colors',
              'hover:bg-(--agency-control-bg-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
          >
            {children}
          </Button>
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
          'agency-gradient flex size-full items-center justify-center text-primary-foreground',
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

function AppShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const getAssistantContextMetadata = useAssistantPageContextMetadata();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const {
    preferences: { assistantLauncherMode, assistantLauncherIcon },
  } = useAgencyUserPreferences();
  const visibleNavSections = useVisibleNavSections();
  const destination = currentDestination(visibleNavSections, pathname);
  const activeSection =
    visibleNavSections.find((section) =>
      section.items.some((item) => item.path === destination?.path)
    ) ?? visibleNavSections[0];
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
    // Match the navigation breakpoint so a hidden drawer cannot retain the modal lock.
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!destination) return;
    rememberWorkspaceItem({
      path: pathname,
      label: destination.name,
      description:
        pathname === destination.path ? destination.description : 'Open ' + destination.name,
    });
  }, [destination, pathname]);

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
          onCloseAutoFocus={(event) => {
            // The opener lives outside the Sheet root, so restore its focus explicitly.
            event.preventDefault();
            if (window.matchMedia('(min-width: 1024px)').matches) {
              document.getElementById('main-content')?.focus();
            } else {
              mobileMenuRef.current?.focus();
            }
          }}
        >
          <SheetTitle className="sr-only">Open Agency navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate between Open Agency workspace and account pages.
          </SheetDescription>
          <div className="relative h-full bg-card">
            <IconButton
              label="Close navigation menu"
              className="absolute right-4 top-[18px]"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </IconButton>
            <NavigationDrawerContent
              sections={visibleNavSections}
              current={destination?.path}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex h-full min-w-0 flex-col">
        <header className="agency-masthead flex min-h-16 shrink-0 items-center gap-4 px-4 sm:px-6 lg:min-h-[76px] lg:gap-7 lg:px-8">
          <div className="lg:hidden">
            <IconButton
              label="Open navigation menu"
              buttonRef={mobileMenuRef}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </IconButton>
          </div>
          <Logo inverted />
          <nav aria-label="Workspace groups" className="hidden min-w-0 items-center gap-1 lg:flex">
            {visibleNavSections.map((section) => (
              <Link
                key={section.title}
                href={section.items[0].path}
                title={section.description}
                aria-current={activeSection?.title === section.title ? 'true' : undefined}
                className="agency-group-link rounded-md px-3 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
              >
                {section.title}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <CommandPalette routes={commandPaletteRoutes} />
            <div className="hidden xl:block">
              <BackendHealthIndicator compact showRefresh={false} />
            </div>
            <div className="hidden sm:block">
              <ThemeToggleButton />
            </div>
            {pathname !== '/assistant' && assistantLauncherMode !== 'hidden' ? (
              <div className="sm:hidden">
                <IconButton
                  label={'Open ' + assistantLabel + ' assistant'}
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
            <div title={user?.name || 'Your profile'}>
              <UserAvatar />
            </div>
          </div>
        </header>
        <nav
          aria-label={(activeSection?.title ?? 'Workspace') + ' destinations'}
          className="agency-destination-rail flex min-h-12 shrink-0 items-stretch gap-2 overflow-x-auto border-b bg-card px-4 sm:px-6 lg:gap-4 lg:px-8"
        >
          <span className="hidden shrink-0 items-center pr-7 text-xs font-semibold text-muted-foreground lg:flex">
            {activeSection?.title}
          </span>
          {activeSection?.items.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={destination?.path === item.path ? 'page' : undefined}
              className="agency-destination-link inline-flex min-h-12 shrink-0 items-center border-b-2 border-transparent px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <main
          id="main-content"
          tabIndex={-1}
          className="agency-workspace-background min-h-0 min-w-0 flex-1 overflow-y-auto bg-(--agency-shell-bg) outline-none"
        >
          <div
            className={cn(
              'mx-auto w-full max-w-[1680px] px-4 pb-28 pt-5 sm:px-6 sm:pb-12 sm:pt-6 lg:px-8',
              pathname === '/assistant' && 'pb-4 sm:pb-4'
            )}
          >
            {children}
          </div>
        </main>
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
