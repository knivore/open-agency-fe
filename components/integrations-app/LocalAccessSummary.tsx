'use client';
import Link from 'next/link';
import {ArrowRight, Monitor} from 'lucide-react';
import {Badge} from '../library/shadcn/badge';
import {Button} from '../library/shadcn/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '../library/shadcn/card';
import {localConnectionLabel, useLocalAccess} from '@/lib/integrations/useLocalAccess';

export default function LocalAccessSummary() {
  const connection = useLocalAccess();
  return (
    <Card aria-labelledby="this-computer-title">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="this-computer-title" role="heading" aria-level={2}>
            <Monitor className="mr-2 inline size-5" aria-hidden="true"/>
            This computer
          </CardTitle>
          <Button asChild variant="outline">
            <Link href="/integrations/local-access">
              Set up browser & apps
              <ArrowRight className="ml-2 size-4" aria-hidden="true"/>
            </Link>
          </Button>
        </div>
        <CardDescription>
          Let Open Agency work with your signed-in Chrome sites and selected Windows or macOS apps.
          You choose what it can access.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {(['chrome', 'apps'] as const).map((target) => (
          <Badge
            key={target}
            variant={connection.data?.[target]?.status === 'connected' ? 'successful' : 'outline'}
          >
            {target === 'chrome' ? 'Chrome' : 'Local apps'} ·{' '}
            {connection.error
              ? 'Status unavailable'
              : localConnectionLabel(connection.data?.[target]?.status)}
          </Badge>
        ))}
        {connection.error ? (
          <p className="text-sm text-muted-foreground">Open setup to retry the connection check.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
