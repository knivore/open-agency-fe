import './globals.css';
import { auth } from '@/auth';
import Providers from '@/app/providers';
import { InlineScript } from '@/app/inline-script';
import AppToaster from '@/components/app-shell/AppToaster';
import type { Metadata } from 'next';
import React from 'react';

const themeInitScript = `
(() => {
  const storageKey = 'agency-theme';
  const stored = window.localStorage.getItem(storageKey);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
  const root = document.documentElement;
  root.dataset.agencyTheme = theme;
  root.classList.toggle('dark', theme === 'dark');
})();
`;

export const metadata: Metadata = {
  title: 'Open Agency',
  description:
    'Open Agency is a local operating harness for designing, running, and inspecting agentic workflows, agents, models, tools, and integrations.',
  icons: {
    icon: {
      url: '/images/open-agency.svg',
      type: 'image/svg+xml',
    },
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InlineScript html={themeInitScript} />
        <title>Open Agency</title>
      </head>
      <body className="min-h-dvh">
        <Providers session={session}>
          {children}
          {/*<Footer />*/}
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
