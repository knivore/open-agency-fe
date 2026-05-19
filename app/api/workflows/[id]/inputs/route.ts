import { getWorkflowInputs } from '@/app/api/utils/workflows';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await getWorkflowInputs(id);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Failed to get workflow inputs: ", e);
    return NextResponse.json({ message: `Internal Server Error ${e}`, status: 500 });
  }
}
