import { createObservatoryLayoutStore } from '@/modules/observatory/server/layoutStore';

import { NextRequest, NextResponse } from 'next/server';

import { markObservatoryLayoutStatus } from '@/modules/observatory/engine/world/layoutPersistence';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

export async function GET() {
  try {
    return NextResponse.json(await createObservatoryLayoutStore().readPublished(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load deployed layout.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      layout?: ObservatoryLayoutDocument;
      notes?: string;
      publishedBy?: string;
    };

    if (!body.layout) {
      return NextResponse.json(
        {
          issues: [{ path: 'layout', reason: 'Missing layout payload.' }],
          message: 'Missing layout payload.',
        },
        { status: 400 }
      );
    }

    const publishedLayout = markObservatoryLayoutStatus(body.layout, 'published', {
      notes: body.notes,
      publishedBy: body.publishedBy,
    });
    const validation = validateObservatoryLayout(publishedLayout);

    if (!validation.layout) {
      return NextResponse.json(
        {
          issues: validation.issues,
          message: 'Published layout failed validation.',
        },
        { status: 400 }
      );
    }

    await createObservatoryLayoutStore().publish(validation.layout);

    return NextResponse.json({
      layout: validation.layout,
      message: 'Deployed layout saved in server storage.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [
          {
            path: 'publish',
            reason: error instanceof Error ? error.message : 'Unable to save published layout.',
          },
        ],
        message: error instanceof Error ? error.message : 'Unable to save published layout.',
      },
      { status: 500 }
    );
  }
}
