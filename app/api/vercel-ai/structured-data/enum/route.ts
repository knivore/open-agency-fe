import { getAzureProvider } from '@/lib/auth/azureProvider';
import { generateText, Output } from 'ai';
import { z, ZodError } from 'zod';

const requestSchema = z.object({
  userQuery: z.string().min(1, 'User query cannot be empty'),
  enum: z.array(z.string()).min(1, 'Enum must have at least one option'),
  systemPrompt: z.string().min(1, 'System prompt cannot be empty'),
});

export async function POST(req: Request) {
  try {
    // Get the Azure provider using the utility function
    const { azure, deploymentName } = getAzureProvider();

    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response('Invalid JSON in request body', { status: 400 });
    }

    const { userQuery, enum: enumOptions, systemPrompt } = requestSchema.parse(body);

    const response = await generateText({
      model: azure(deploymentName),
      output: Output.choice({ options: enumOptions }),
      prompt: `${systemPrompt}
        User input: ${userQuery}`,
    });

    return new Response(JSON.stringify({ data: response.output }), { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response('Invalid input', { status: 400 });
    }

    if (error instanceof Error && error.name === 'AI_TypeValidationError') {
      return new Response('Invalid AI response', { status: 500 });
    }

    console.error('Error fetching Azure OpenAI response:', error);
    return new Response('Failed to fetch message stream', { status: 500 });
  }
}
