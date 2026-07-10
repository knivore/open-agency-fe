import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Home, ShieldCheck } from 'lucide-react';

import PageHeader from '@/components/app-shell/PageHeader';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import { getIntegrationModuleAvailability } from '@/lib/integrations/moduleAvailability';

export const metadata: Metadata = {
  title: 'Smart Home Setup | Open Agency',
  description: 'Connect Home Assistant to Open Agency and verify imported devices.',
};

const CONNECTOR_SETUP_HREF =
  '/integrations?integration-tab=home-tools&integration-connector=home-tools-home-assistant&connector-action=start-setup';

const steps = [
  {
    title: 'Prepare Home Assistant',
    detail:
      'Confirm the devices you need already appear in Home Assistant, then create a long-lived access token from your Home Assistant profile.',
  },
  {
    title: 'Connect it to Open Agency',
    detail:
      'Open the secure setup flow, enter the Home Assistant URL and token, and let Open Agency store the connection for workflows.',
  },
  {
    title: 'Verify one device',
    detail:
      'Open Devices and confirm one expected entity appears. Start with a read-only check before allowing workflow actions.',
  },
];

export default async function SmartHomeSetupPage() {
  const availability = await getIntegrationModuleAvailability();
  const unavailableReason =
    availability.smartHomeAvailable === false
      ? (availability.smartHomeReason ?? 'Smart Home is unavailable on this backend.')
      : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={Home}
        tone="integration"
        title="Set up Smart Home"
        description="Connect Home Assistant once, verify a device, and then use home entities inside workflows."
        meta={
          <Badge variant={unavailableReason ? 'outline' : 'successful'}>
            {unavailableReason ? 'Unavailable' : 'Ready to connect'}
          </Badge>
        }
        actions={
          <>
            {unavailableReason ? (
              <Button disabled title={unavailableReason}>
                Setup unavailable
              </Button>
            ) : (
              <Button asChild>
                <Link href={CONNECTOR_SETUP_HREF}>
                  Start setup
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/operations/devices">Open Devices</Link>
            </Button>
          </>
        }
      />

      {unavailableReason ? (
        <Card className="border-(--agency-warning-border) bg-(--agency-warning-bg)">
          <CardContent className="flex flex-col gap-2 p-5 text-sm text-(--agency-warning-text)">
            <p className="font-medium">Smart Home is not enabled on this backend.</p>
            <p>{unavailableReason}</p>
            <Button asChild variant="outline" className="mt-2 self-start">
              <Link href="/assistant">Ask Assistant what to enable</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="size-5 text-primary" />
              Three steps to a working connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-(--agency-shell-border)">
              {steps.map((step, index) => (
                <li key={step.title} className="grid gap-3 py-5 sm:grid-cols-[2.25rem_1fr]">
                  <span className="flex size-9 items-center justify-center rounded-full border border-(--agency-shell-border) bg-background text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-semibold text-(--agency-shell-text)">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-primary" />
              Before you start
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-3 text-sm leading-6 text-(--agency-shell-muted)">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-success-600" />A reachable Home
                Assistant URL
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-success-600" />A long-lived
                access token
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-success-600" />
                One device to use as a safe test
              </li>
            </ul>
            <Button asChild variant="outline" className="w-full">
              <Link href="/assistant">Ask Assistant for help</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
