import { cn } from '@/lib/utils';

import {
  AgentActionSchema,
  AgentFinishSchema,
  UnknownVerboseSchema,
  VerboseOutput,
  AgentAction,
  AgentFinish,
  UnknownVerbose,
} from '@/types/domain/verbose';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../library/shadcn/card';

export default function WorkflowVerboseCard({ verbose }: { verbose: VerboseOutput }) {
  return (
    <Card className="space-y-2">
      <CardHeader className="space-y-0 pb-0">
        <Header agentName={verbose.agent_name} type={verbose.type} timestamp={verbose.timestamp} />
      </CardHeader>
      <CardContent className="space-y-0">{getValidatedContent(verbose)}</CardContent>
    </Card>
  );
}

const Header = ({
  agentName,
  type,
  timestamp,
}: {
  agentName: string;
  type: string;
  timestamp: string;
}) => {
  return (
    <div className="flex justify-between items-start">
      <div>
        <CardTitle className="text-h3">{agentName}</CardTitle>
        <CardDescription className="text-caption-2 text-muted-foreground">{type}</CardDescription>
      </div>
      <p className="text-caption-2 text-muted-foreground/50 italic">
        {new Date(timestamp)
          .toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          .split(',')[0] +
          ' - ' +
          new Date(timestamp).toLocaleString('en-US', {
            day: 'numeric',
            month: 'short',
          })}
      </p>
    </div>
  );
};

const SubHeader = ({ title, className }: { title: string; className?: string }) => {
  return (
    <>
      <p className={cn('text-caption-1 mb-0.5', className)}>{title}</p>
    </>
  );
};

const TextBody = ({ text, className }: { text: string; className?: string }) => {
  return <p className={cn('text-sm text-muted-foreground', className)}>{text}</p>;
};

function processText(input: string) {
  return input?.split('\n')[0] || '';
}

const AgentActionBody = ({ result, text, thought, tool, tool_input }: AgentAction) => {
  return (
    <div className="space-y-4">
      <div>
        <SubHeader title="Thought" />
        <TextBody text={processText(thought || text)} />
      </div>
      <div>
        <SubHeader title="Action" />
        <TextBody text={`Using tool: ${tool}`} />
        {tool_input && (
          <TextBody
            text={`Input: ${typeof tool_input === 'string' ? tool_input : JSON.stringify(tool_input)}`}
          />
        )}
      </div>
      <div className="border border-primary bg-primary-50 rounded-lg p-4">
        <SubHeader title="Result" className="text-primary" />
        <TextBody text={processText(result)} className="text-foreground" />
      </div>
    </div>
  );
};

const AgentFinishBody = ({ output, text, thought }: AgentFinish) => {
  return (
    <div className="space-y-4">
      <div>
        <SubHeader title="Thought" />
        <TextBody text={processText(thought || text)} />
      </div>
      <div className="border border-success bg-success-50 rounded-lg p-4">
        <SubHeader title="Output" className="text-success font-semibold" />
        <TextBody text={processText(output)} className="text-foreground" />
      </div>
    </div>
  );
};

const UnknownVerboseBody = ({ output }: UnknownVerbose) => {
  return (
    <div>
      <TextBody text={output} />
    </div>
  );
};

const getValidatedContent = (verbose: VerboseOutput) => {
  try {
    const actionResult = AgentActionSchema.safeParse(verbose);
    if (actionResult.success) {
      return <AgentActionBody {...actionResult.data} />;
    } else {
      console.error('AgentActionSchema validation failed:', actionResult.error.issues);
    }

    const finishResult = AgentFinishSchema.safeParse(verbose);
    if (finishResult.success) {
      return <AgentFinishBody {...finishResult.data} />;
    } else {
      console.error('AgentFinishSchema validation failed:', finishResult.error.issues);
    }

    const unknownResult = UnknownVerboseSchema.safeParse(verbose);
    if (unknownResult.success) {
      return <UnknownVerboseBody {...unknownResult.data} />;
    } else {
      console.error('UnknownVerboseSchema validation failed:', unknownResult.error.issues);
    }

    return <div className="p-4 text-sm text-red-500">Invalid verbose output format</div>;
  } catch (error) {
    console.error('Error validating verbose output:', error);
    return <div className="p-4 text-sm text-red-500">Error processing verbose output</div>;
  }
};
