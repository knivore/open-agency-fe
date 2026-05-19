import { useWorkflowRunContext } from './WorkflowRunProvider';
import WorkflowVerboseCard from './WorkflowVerboseCard';
import { Alert, AlertTitle, AlertDescription } from '../../library/shadcn/alert';
import { AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '../../library/shadcn/card';
import { Separator } from '../../library/shadcn/separator';

export default function WorkflowProcessWindow() {
  const { output, verboseOutput, error } = useWorkflowRunContext();

  return (
    <div className="w-[40vw] max-h-[92vh] space-y-2 mx-auto">
      {error && <Error error={error} />}
      {output && <Output output={output} />}
      {output && verboseOutput.length > 0 && <Separator />}
      {verboseOutput.length > 0 && (
        <>
          {verboseOutput.map((verbose, index) => (
            <WorkflowVerboseCard key={index} verbose={verbose} />
          ))}
        </>
      )}
    </div>
  );
}

const Error = ({ error }: { error: string }) => {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to Run Workflow</AlertTitle>
      <AlertDescription>Refer to console for more details.</AlertDescription>
    </Alert>
  );
};

const Output = ({ output }: { output: string }) => {
  return (
    <Card
      className="space-y-2 animate-border-pulse"
      style={{ '--pulse-color': 'hsl(var(--primary-600))' } as React.CSSProperties}
    >
      <CardHeader className="space-y-0 pb-0">
        <CardTitle className="text-h3">Workflow Output</CardTitle>
        <CardDescription className="text-caption-2 text-muted-foreground">
          The final output of the process.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        <Alert className="bg-success-50 border-success-600 space-y-2 p-4">
          <AlertDescription>
            <p className="whitespace-pre-wrap text-caption-1">{output}</p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
