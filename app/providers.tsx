'use client';
import { environmentManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { setApiClientIdentityHeadersProvider, setApiClientTokenProvider } from '@/lib/api/auth';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { usersApi } from '@/lib/api/backend/users';
import type { AuthUser } from '@/types/auth';

type AgencyTheme = 'light' | 'dark';

type ThemeContextValue = {
  setTheme: (theme: AgencyTheme) => void;
  theme: AgencyTheme;
  toggleTheme: () => void;
};

const themeStorageKey = 'agency-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

// * react-query set-up: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#initial-setup
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// * Provider for next-auth and react-query
function AuthSessionSync() {
  const { data: session, status } = useSession();
  const user = session?.user as AuthUser | undefined;

  useEffect(() => {
    // Locally generated dev tokens are only NextAuth session markers; backend
    // auth tokens should still flow to direct Agency API calls.
    const sessionToken =
      user?.authMode === 'dev' && user.accessToken?.startsWith('dev-')
        ? null
        : (user?.accessToken ?? null);

    setApiClientTokenProvider(() => sessionToken);
    setApiClientIdentityHeadersProvider(() =>
      user?.authMode === 'dev' ? currentUserHeaders(user) : null
    );

    return () => {
      setApiClientIdentityHeadersProvider(null);
      setApiClientTokenProvider(null);
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id || !user.email) {
      return;
    }

    // Backend-issued local-auth sessions already originate from Agency user
    // records. Re-syncing them through the identity bridge would overwrite
    // admin roles and local-auth metadata with the thinner frontend session.
    if (user.authMode === 'dev' && user.accessToken && !user.accessToken.startsWith('dev-')) {
      return;
    }

    void usersApi.syncCurrentUser(user).catch(() => {
      // Backend user sync is non-blocking during the identity migration.
    });
  }, [user]);

  if (status === 'loading') {
    return null;
  }

  return null;
}

function readPreferredTheme(): AgencyTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: AgencyTheme) {
  const root = document.documentElement;
  root.dataset.agencyTheme = theme;
  root.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(themeStorageKey, theme);
}

function subscribeToHydration() {
  return () => {};
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const [themeOverride, setThemeOverride] = useState<AgencyTheme | null>(null);
  const theme = themeOverride ?? (isHydrated ? readPreferredTheme() : 'light');

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    applyTheme(theme);
  }, [isHydrated, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      setTheme: (nextTheme) => {
        setThemeOverride(nextTheme);
      },
      theme,
      toggleTheme: () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        setThemeOverride(nextTheme);
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAgencyTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAgencyTheme must be used within ThemeProvider');
  }

  return context;
}

export function useOptionalAgencyTheme() {
  return useContext(ThemeContext);
}

export default function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  const queryClient = getQueryClient();

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthSessionSync />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
