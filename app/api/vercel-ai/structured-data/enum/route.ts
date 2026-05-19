import { getAzureProvider } from '@/lib/auth/azureProvider';
import { generateObject } from 'ai';
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

    const response = await generateObject({
      model: azure(deploymentName),
      output: 'enum',
      enum: enumOptions,
      prompt: `${systemPrompt}
        User input: ${userQuery}`,
    });

    const { object } = response;

    return new Response(JSON.stringify({ data: object }), { status: 200 });
  } catch (error) {
    console.error('Error fetching Azure OpenAI response:', error);
    if (error instanceof ZodError) {
      console.log('ZodError', error);
      return new Response('Invalid input', { status: 400 });
    }

    if (error instanceof Error && error.name === 'AI_TypeValidationError') {
      console.log('AI_TypeValidationError: Result must be in the enum');
      return new Response('Invalid AI response', { status: 500 });
    }

    return new Response('Failed to fetch message stream', { status: 500 });
  }
}
