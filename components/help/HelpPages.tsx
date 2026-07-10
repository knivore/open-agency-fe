import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bot,
  BotMessageSquare,
  BrainCog,
  CircleHelp,
  PlugZap,
  Radar,
  Workflow,
} from 'lucide-react';

import PageHeader from '@/components/app-shell/PageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/library/shadcn/accordion';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/library/shadcn/card';

const faqGroups = [
  {
    title: 'Getting started',
    items: [
      {
        question: 'What is Open Agency?',
        answer:
          'Open Agency is a local operating harness for designing agentic workflows, assigning reusable agents and personas, connecting models and tools, and following executions from start to finish.',
      },
      {
        question: 'Where should I begin after setup?',
        answer:
          'Start in Models to confirm a runnable model profile, create or review an Agent, then open Workflows to connect tasks, agents, tools, and runtime settings. Run the workflow once with a small test input before adding a schedule.',
      },
      {
        question: 'What is the difference between an agent, persona, and workflow?',
        answer:
          'An agent defines a runnable role and its capabilities. A persona captures reusable identity, expertise, and behavior. A workflow coordinates tasks, agents, tools, dependencies, inputs, memory, governance, and execution settings into one repeatable process.',
      },
    ],
  },
  {
    title: 'Runs and operations',
    items: [
      {
        question: 'Where can I see why a run failed?',
        answer:
          'Open Runs, select the affected session, and review its event timeline, task state, logs, tool activity, artifacts, and approvals. Use Operations → Diagnostics when the failure appears to involve backend health or connectivity rather than workflow logic.',
      },
      {
        question: 'Why is a workflow not running on schedule?',
        answer:
          'Confirm the schedule is enabled, has a valid timezone and next-fire time, and that the workflow still has a runnable runtime adapter and model. Then check backend health and the latest run history for rejected inputs, missing credentials, or governance blocks.',
      },
      {
        question: 'What does the main-agent monitor do?',
        answer:
          'The monitor shows the main agent’s current supervisory work, recent activity, and state transitions. Use the Assistant for conversation and approvals, and Runs for execution-level evidence.',
      },
    ],
  },
  {
    title: 'Integrations and security',
    items: [
      {
        question: 'How do I set up an integration?',
        answer:
          'Open Integrations, choose the service, then follow the fields shown for that connector. Save the credential, run the built-in connection test, and only attach it to a workflow after the test reports healthy. If a required backend capability is missing, Ask Assistant can explain what this install needs.',
      },
      {
        question: 'How do I connect an LLM model?',
        answer:
          'Open Models and choose Add Model. Select or create the provider connection, enter the model name, save the preset, and confirm its capability labels match the workflow—especially tools, structured output, vision, and streaming. Start with one model and add fallbacks only after the primary path works.',
      },
      {
        question: 'How do I connect an MCP server?',
        answer:
          'Open Integrations and choose the MCP category. Pick the supported transport, provide the server address or local command requested by the form, save it, and run the connection test. Review the discovered capabilities before assigning the server to an agent or workflow.',
      },
      {
        question: 'How do I connect Home Assistant?',
        answer:
          'Open Smart Home from Setup. Confirm the Home Assistant base URL and long-lived access token, save the connection, then verify one harmless entity before using it in a workflow. Keep command-capable devices behind the approval and allowlist controls shown by Open Agency.',
      },
      {
        question: 'Where are integration secrets stored?',
        answer:
          'Open Agency stores connector secrets through its configured credential path and references them by credential or installation id. Secret values should not be copied into workflow descriptions, prompts, logs, or guide notes.',
      },
      {
        question: 'Why is an integration setup action unavailable?',
        answer:
          'Some connectors depend on a backend module or provider capability. Open Agency keeps unavailable actions disabled and shows what is missing. Open Assistant if you want the Main Agent to explain the next step for this install.',
      },
      {
        question: 'How should I test a new connector safely?',
        answer:
          'Start with the smallest allowed workspace, channel, device, or account. Apply a narrow allowlist, use the connector test action, confirm both an allowed and blocked case, and only then expand access or attach it to an automated workflow.',
      },
    ],
  },
  {
    title: 'Interface and preferences',
    items: [
      {
        question: 'Does Open Agency remember light or dark mode?',
        answer:
          'Yes. Your theme preference is stored in this browser. On a browser without a saved preference, Open Agency follows the operating system theme.',
      },
      {
        question: 'Why do I see different navigation items from another install?',
        answer:
          'Open Agency hides module-specific pages when the local backend says that capability is unavailable. Diagnostics can also be shown or hidden from Profile preferences.',
      },
    ],
  },
];

type ActionCardProps = {
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
};

function ActionCard({ description, href, icon: Icon, title }: ActionCardProps) {
  return (
    <Link href={href} className="group block h-full outline-none">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-(--agency-row-hover) group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader>
          <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-(--agency-shell-border) bg-background text-primary">
            <Icon className="size-[1.1rem] stroke-[1.75]" />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-4">
          <p className="text-sm leading-6 text-(--agency-shell-muted)">{description}</p>
          <ArrowRight className="size-4 shrink-0 text-(--agency-shell-muted) transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}

const quickStartSteps = [
  {
    description: 'Add one provider and confirm the model capabilities your workflow needs.',
    href: '/models',
    icon: BrainCog,
    label: 'Connect a model',
    step: '01',
    tone: 'model',
  },
  {
    description: 'Create a focused runtime role, or publish a persona-backed agent.',
    href: '/agents',
    icon: Bot,
    label: 'Choose an agent',
    step: '02',
    tone: 'agent',
  },
  {
    description: 'Connect the steps, run a small test, and inspect the result in Runs.',
    href: '/workflows',
    icon: Workflow,
    label: 'Run a workflow',
    step: '03',
    tone: 'workflow',
  },
] as const;

function QuickStartPath() {
  return (
    <section
      className="agency-card overflow-hidden rounded-xl border"
      aria-labelledby="quick-start-title"
    >
      <div className="border-b border-(--agency-shell-border) px-5 py-4 sm:px-6">
        <h2 id="quick-start-title" className="text-base font-semibold text-(--agency-shell-text)">
          Fastest path to a working workflow
        </h2>
        <p className="mt-1 text-sm text-(--agency-shell-muted)">
          Start with the smallest useful setup. Add integrations only when the workflow needs them.
        </p>
      </div>
      <div className="grid md:grid-cols-3">
        {quickStartSteps.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tone={item.tone}
              className="agency-quick-start group relative flex min-h-40 flex-col gap-4 border-(--agency-shell-border) p-5 outline-none transition-colors hover:bg-(--agency-row-hover) focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:border-r md:last:border-r-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="agency-quick-start-icon flex size-9 items-center justify-center rounded-lg border">
                  <Icon className="size-[1.05rem] stroke-[1.75]" />
                </span>
                <span className="text-[0.68rem] font-semibold tracking-[0.14em] text-(--agency-shell-muted)">
                  STEP {item.step}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-(--agency-shell-text)">{item.label}</h3>
                <p className="mt-1.5 text-sm leading-6 text-(--agency-shell-muted)">
                  {item.description}
                </p>
              </div>
              {index < quickStartSteps.length - 1 ? (
                <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 rounded-full border border-(--agency-shell-border) bg-background p-1 text-(--agency-shell-muted) md:block" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function FaqPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={CircleHelp}
        tone="help"
        title="Frequently asked questions"
        description="Essential answers for setting up this Open Agency install, running workflows, and understanding what happened."
        actions={
          <Button asChild>
            <Link href="/assistant">
              <BotMessageSquare data-icon="inline-start" />
              Ask Assistant
            </Link>
          </Button>
        }
      />

      <QuickStartPath />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-5">
          {faqGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="text-base">{group.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {group.items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger className="text-left text-sm no-underline hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="max-w-3xl text-sm leading-6 text-(--agency-shell-muted)">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <ActionCard
            icon={BotMessageSquare}
            title="Ask Assistant"
            description="Let the Main Agent explain this screen or help you choose the next step."
            href="/assistant"
          />
          <ActionCard
            icon={PlugZap}
            title="Set up integrations"
            description="Choose a connector, save its credential, and run its health test."
            href="/integrations"
          />
          <ActionCard
            icon={Radar}
            title="Diagnostics"
            description="Check local backend health, readiness, and operational evidence."
            href="/operations/diagnostics"
          />
          <ActionCard
            icon={Activity}
            title="Run history"
            description="Inspect the exact execution, events, artifacts, and approval state."
            href="/runs"
          />
        </aside>
      </div>
    </div>
  );
}
