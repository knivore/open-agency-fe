import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getWorkflowPreview } from '@/app/api/utils/workflows';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await getWorkflowPreview(id);
    if (!result) {
      return NextResponse.json({ message: 'Workflow not found', status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod error: ', e.issues);
      return NextResponse.json({ message: `Invalid request body: ${e.issues}`, status: 400 });
    }
    console.error("Failed to get workflow preview: ", e);
    return NextResponse.json({ message: `Internal Server Error ${e}`, status: 500 });
  }
}
