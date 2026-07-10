import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, DatabaseZap, ShieldCheck } from 'lucide-react';

import PageHeader from '@/components/app-shell/PageHeader';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import { getIntegrationModuleAvailability } from '@/lib/integrations/moduleAvailability';

export const metadata: Metadata = {
  title: 'Physical Devices Setup | Open Agency',
  description: 'Enable audited physical-device operations for Open Agency workflows.',
};

export default async function PhysicalDevicesSetupPage() {
  const availability = await getIntegrationModuleAvailability();
  const unavailableReason =
    availability.physicalDevicesAvailable === false
      ? (availability.physicalDevicesReason ?? 'Physical Devices is unavailable on this backend.')
      : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={DatabaseZap}
        tone="monitor"
        title="Set up Physical Devices"
        description="Use this optional module when workflows need canonical device IDs, command approvals, and an audit trail."
        meta={
          <Badge variant={unavailableReason ? 'outline' : 'successful'}>
            {unavailableReason ? 'Unavailable' : 'Module available'}
          </Badge>
        }
        actions={
          <>
            <Button asChild>
              <Link href="/operations/devices">
                Open Devices
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/assistant">Ask Assistant</Link>
            </Button>
          </>
        }
      />

      {unavailableReason ? (
        <Card className="border-(--agency-warning-border) bg-(--agency-warning-bg)">
          <CardContent className="flex flex-col gap-2 p-5 text-sm text-(--agency-warning-text)">
            <p className="font-medium">Physical Devices is not enabled on this backend.</p>
            <p>{unavailableReason}</p>
            <p>Smart Home devices can still appear in the shared Devices page.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DatabaseZap className="size-5 text-primary" />
              What to do
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-(--agency-shell-border)">
              {[
                [
                  'Enable the module',
                  'Start the backend with the Physical Devices module enabled.',
                ],
                [
                  'Verify the registry',
                  'Open Devices and confirm the expected canonical device records appear.',
                ],
                [
                  'Test a safe action',
                  'Use a non-restricted device first, then check that the command and audit result are recorded.',
                ],
              ].map(([title, detail], index) => (
                <li key={title} className="grid gap-3 py-5 sm:grid-cols-[2.25rem_1fr]">
                  <span className="flex size-9 items-center justify-center rounded-full border border-(--agency-shell-border) bg-background text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-semibold text-(--agency-shell-text)">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">{detail}</p>
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
              Use it when you need
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm leading-6 text-(--agency-shell-muted)">
              {[
                'Stable device IDs across adapters',
                'Approval gates for restricted actions',
                'Command, event, and policy audit history',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-success-600" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
