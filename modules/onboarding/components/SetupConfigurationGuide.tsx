import Link from 'next/link';
import { ArrowUpRight, Settings2 } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/library/shadcn/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Separator } from '@/components/library/shadcn/separator';

type TunnelProvider = 'auto' | 'none' | 'ngrok' | 'cloudflare';

type SetupConfigurationGuideProps = {
  statusKnown: boolean;
  tunnelKnown: boolean;
  databaseReady: boolean;
  adminReady: boolean;
  modelReady: boolean;
  mainAgentReady: boolean;
  openVoiceReady: boolean;
  tunnelProvider: TunnelProvider;
};

type GuideItem = {
  name: string;
  automation: string;
  status: string;
  statusVariant: BadgeProps['variant'];
  updateLabel: string;
  updateHref?: string;
};

function GuideItemRow({ item }: { item: GuideItem }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{item.name}</p>
        <Badge variant={item.statusVariant}>{item.status}</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{item.automation}</p>
      <p className="text-xs leading-5 text-muted-foreground">
        Change later:{' '}
        {item.updateHref ? (
          <Link
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
            href={item.updateHref}
          >
            {item.updateLabel}
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        ) : (
          item.updateLabel
        )}
      </p>
    </div>
  );
}

function readinessItem(
  name: string,
  statusKnown: boolean,
  ready: boolean,
  automation: string,
  updateLabel: string,
  updateHref?: string
): GuideItem {
  return {
    name,
    automation,
    status: !statusKnown ? 'Checking' : ready ? 'Ready' : 'Needs setup',
    statusVariant: ready ? 'successful' : 'outline',
    updateLabel,
    updateHref,
  };
}

export default function SetupConfigurationGuide({
  statusKnown,
  tunnelKnown,
  databaseReady,
  adminReady,
  modelReady,
  mainAgentReady,
  openVoiceReady,
  tunnelProvider,
}: SetupConfigurationGuideProps) {
  const requiredItems = [
    readinessItem(
      'Database',
      statusKnown,
      databaseReady,
      'The launcher starts and migrates the bundled database. A custom database remains operator-managed.',
      'Environment configuration and restart'
    ),
    readinessItem(
      'Local administrator',
      statusKnown,
      adminReady,
      'Setup creates the first administrator and signs it in. It never creates additional users automatically.',
      'Sign-in and personal settings in Profile',
      '/profile#local-sign-in'
    ),
    readinessItem(
      'Model profile',
      statusKnown,
      modelReady,
      'Setup can create an OpenAI or Ollama profile, or reuse an existing runnable profile.',
      'Models',
      '/models'
    ),
    readinessItem(
      'Main Agent',
      statusKnown,
      mainAgentReady,
      'Setup creates the default Main Agent or points the existing profile at the selected model.',
      'Agents',
      '/agents'
    ),
  ];

  const tunnelStatus = !tunnelKnown
    ? 'Checking'
    : tunnelProvider === 'auto'
      ? 'Automatic'
      : tunnelProvider === 'none'
        ? 'Local only'
        : tunnelProvider === 'cloudflare'
          ? 'Cloudflare'
          : 'ngrok';
  const optionalItems: GuideItem[] = [
    {
      name: 'Supporting agents',
      automation:
        'Coder, Embedding, and Evaluation agents are provisioned only when the optional quick-setup choice is enabled.',
      status: 'User choice',
      statusVariant: 'secondary',
      updateLabel: 'Agents',
      updateHref: '/agents',
    },
    {
      name: 'Public tunnel',
      automation:
        'Automatic mode lets the launcher choose an available provider. Saved provider or domain changes apply after restart.',
      status: tunnelStatus,
      statusVariant: 'secondary',
      updateLabel: 'Public tunnel below',
      updateHref: '/setup#public-tunnel',
    },
    {
      name: 'OpenVoice',
      automation:
        'The runtime can be bundled with the backend image; model files and the default friendly voice can be installed or changed on demand.',
      status: !statusKnown ? 'Checking' : openVoiceReady ? 'Ready' : 'Optional',
      statusVariant: openVoiceReady ? 'successful' : 'secondary',
      updateLabel: 'OpenVoice in Profile',
      updateHref: '/profile#openvoice',
    },
    {
      name: 'Integrations and credentials',
      automation:
        'They do not block readiness. Add only the providers a workflow needs; Open Agency keeps credential entry inside OneCLI.',
      status: 'As needed',
      statusVariant: 'secondary',
      updateLabel: 'Integrations',
      updateHref: '/integrations',
    },
    {
      name: 'Automation keys',
      automation:
        'Open Agency never issues external API keys automatically. Create a least-privilege key only for a trusted script or service.',
      status: 'On demand',
      statusVariant: 'secondary',
      updateLabel: 'Automation keys in Profile',
      updateHref: '/profile#automation-keys',
    },
  ];

  return (
    <Card id="configuration-lifecycle">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" aria-hidden="true" />
            What setup manages
          </h2>
        </CardTitle>
        <CardDescription>
          Required items make Open Agency runnable. Optional capabilities stay available after setup
          and have a clear settings owner.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section aria-labelledby="required-setup-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="required-setup-heading" className="text-sm font-semibold text-foreground">
              Required for readiness
            </h3>
            <Badge>4 checks</Badge>
          </div>
          <div className="divide-y divide-border">
            {requiredItems.map((item) => (
              <GuideItemRow key={item.name} item={item} />
            ))}
          </div>
        </section>

        <Separator />

        <section aria-labelledby="optional-setup-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="optional-setup-heading" className="text-sm font-semibold text-foreground">
              Optional and configurable later
            </h3>
            <Badge variant="secondary">Does not block setup</Badge>
          </div>
          <div className="divide-y divide-border">
            {optionalItems.map((item) => (
              <GuideItemRow key={item.name} item={item} />
            ))}
          </div>
        </section>
      </CardContent>
      <CardFooter className="text-xs leading-5 text-muted-foreground">
        The local owner manages login email and password in Profile. Database secrets, deployment
        credentials, and any external authentication provider remain operator-managed.
      </CardFooter>
    </Card>
  );
}
