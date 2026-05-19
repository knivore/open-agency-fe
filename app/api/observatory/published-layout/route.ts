import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextRequest, NextResponse } from 'next/server';

import {
  markObservatoryLayoutStatus,
  serializeObservatoryLayout,
} from '@/modules/observatory/engine/world/layoutPersistence';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

const publishedLayoutPath = path.join(process.cwd(), 'modules', 'observatory', 'layouts', 'publishedLayout.json');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
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
        { status: 400 },
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
        { status: 400 },
      );
    }

    await writeFile(publishedLayoutPath, `${serializeObservatoryLayout(validation.layout)}\n`, 'utf8');

    return NextResponse.json({
      layout: validation.layout,
      message: 'Published layout saved to repo.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [{ path: 'publish', reason: error instanceof Error ? error.message : 'Unable to save published layout.' }],
        message: error instanceof Error ? error.message : 'Unable to save published layout.',
      },
      { status: 500 },
    );
  }
}
