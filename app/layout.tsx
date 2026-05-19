import './globals.css';
import Providers from '@/app/providers';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import Footer from '@/app/footer';

export const metadata: Metadata = {
  title: 'Agency',
  description:
    'Agency is a workflow creation platform designed for officers to design and create their agentic workflow to help them improve their productivity.',
  icons: {
    icon: {
      url: '/images/agency.svg',
      type: 'image/svg+xml',
    },
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
    <body className="h-screen flex flex-col">
    <Providers>
      <div className="flex-1">{children}</div>
      {/*<Footer />*/}
      <Toaster />
    </Providers>
    </body>
    </html>
  );
}
