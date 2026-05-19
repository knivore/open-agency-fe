import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params;
    return NextResponse.json(
      {
        success: false,
        workflowId,
        message:
          'Token-based external workflow execution is disabled in the frontend. Move API token issuance and verification into the backend before re-enabling this route.',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error running workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow execution', details: String(error) },
      { status: 500 }
    );
  }
}
