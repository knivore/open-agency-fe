'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, LoaderCircle, Moon, Sun } from 'lucide-react';

import { useAgencyTheme } from '@/app/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import { isAgencyDevAuthEnabled } from '@/lib/api/config';

function getSafeCallbackUrl(value: string | null) {
  if (!value) {
    return '/workflows';
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}` || '/workflows';
  } catch {
    return '/workflows';
  }
}

function ThemeToggle() {
  const { theme, toggleTheme } = useAgencyTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex size-10 items-center justify-center rounded-full border border-(--agency-control-border) bg-(--agency-control-bg) text-(--agency-shell-muted) shadow-(--agency-outline-shadow) outline-none transition-colors hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isDark ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
    </button>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden overflow-hidden border-r border-(--agency-shell-border) bg-(--agency-sidebar-bg) lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--agency-grid-dot) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom right, black, transparent 72%)',
        }}
      />
      <div className="relative flex items-center gap-3">
        <Image src="/images/open-agency.svg" alt="Open Agency" width={38} height={38} priority />
        <span className="text-xl font-semibold tracking-[-0.03em] text-(--agency-shell-text)">
          Open Agency
        </span>
      </div>

      <div className="relative max-w-xl pb-[8vh]">
        <h1 className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-(--agency-shell-text) xl:text-5xl">
          Your agentic workspace, clearly orchestrated.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-(--agency-shell-muted)">
          Design workflows, coordinate agents, and keep every execution visible from one calm
          operating surface.
        </p>
      </div>

      <p className="relative text-xs text-(--agency-shell-muted)">
        Secure local development access
      </p>
    </section>
  );
}

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callbackUrl = useMemo(
    () => getSafeCallbackUrl(searchParams.get('callbackUrl')),
    [searchParams]
  );
  const isDevAuthEnabled = isAgencyDevAuthEnabled();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setErrorMessage('Invalid email or password. Check your local development credentials.');
      return;
    }

    router.replace(callbackUrl);
    router.refresh();
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-(--agency-shell-bg) px-6 text-(--agency-shell-text)">
        <div className="flex items-center gap-3 text-sm text-(--agency-shell-muted)">
          <LoaderCircle className="size-4 animate-spin" />
          Checking authentication status…
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh bg-(--agency-shell-bg) text-(--agency-shell-text) lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
      <BrandPanel />
      <section className="relative flex min-h-dvh items-center justify-center overflow-y-auto px-5 py-20 sm:px-10 lg:px-12">
        <div className="absolute right-5 top-5 sm:right-8 sm:top-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[430px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <Image
              src="/images/open-agency.svg"
              alt="Open Agency"
              width={34}
              height={34}
              priority
            />
            <span className="text-lg font-semibold tracking-[-0.03em]">Open Agency</span>
          </div>

          <div className="mb-8">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--agency-header-eyebrow)">
              Development access
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Sign in</h2>
            <p className="mt-3 text-sm leading-6 text-(--agency-shell-muted)">
              Use the local admin credentials created during setup.
            </p>
          </div>

          {isDevAuthEnabled ? (
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="dev@example.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button className="mt-1 w-full" size="lg" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          ) : (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Development login disabled</AlertTitle>
              <AlertDescription>
                Enable local development authentication to sign in. Azure AD remains the production
                authentication path.
              </AlertDescription>
            </Alert>
          )}

          <p className="mt-7 text-center text-xs text-(--agency-shell-muted)">
            Credentials stay within your local Open Agency environment.
          </p>
        </div>
      </section>
    </main>
  );
}
