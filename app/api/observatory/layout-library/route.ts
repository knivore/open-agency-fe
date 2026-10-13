import { createObservatoryLayoutStore } from '@/modules/observatory/server/layoutStore';

import { NextRequest, NextResponse } from 'next/server';

import { markObservatoryLayoutStatus } from '@/modules/observatory/engine/world/layoutPersistence';
import {
  summarizeObservatoryLayoutLibraryEntry,
  type ObservatoryLayoutLibraryEntry,
} from '@/modules/observatory/engine/world/layoutLibrary';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

export async function GET() {
  try {
    const entries = await createObservatoryLayoutStore().readLibrary();

    return NextResponse.json({
      entries,
      summaries: entries.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [
          {
            path: 'layoutLibrary',
            reason: error instanceof Error ? error.message : 'Unable to read layout library.',
          },
        ],
        message: error instanceof Error ? error.message : 'Unable to read layout library.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fileId?: string;
      layout?: ObservatoryLayoutDocument;
      mode?: 'create' | 'update' | 'restore';
      name?: string;
      notes?: string;
    };

    if (body.mode === 'restore' && body.fileId) {
      const store = createObservatoryLayoutStore();
      await store.restore(body.fileId);
      return NextResponse.json({
        entries: await store.readLibrary(),
        message: 'Restored saved layout.',
      });
    }
    if (!body.layout) {
      return NextResponse.json(
        {
          issues: [{ path: 'layout', reason: 'Missing layout payload.' }],
          message: 'Missing layout payload.',
        },
        { status: 400 }
      );
    }

    const preparedLayout = markObservatoryLayoutStatus(
      {
        ...body.layout,
        metadata: {
          ...body.layout.metadata,
          ...(body.name?.trim() ? { name: body.name.trim() } : {}),
          ...(body.notes !== undefined ? { notes: body.notes.trim() || undefined } : {}),
        },
      },
      'draft'
    );
    const validation = validateObservatoryLayout(preparedLayout);

    if (!validation.layout) {
      return NextResponse.json(
        {
          issues: validation.issues,
          message: 'Saved layout failed validation.',
        },
        { status: 400 }
      );
    }

    const existingEntries = await createObservatoryLayoutStore().readLibrary();
    const fileId = resolveLayoutFileId(
      body.fileId,
      body.name,
      validation.layout,
      existingEntries,
      body.mode === 'update' ? 'update' : 'create'
    );

    if (body.mode === 'update' && !body.fileId) {
      return NextResponse.json(
        {
          issues: [{ path: 'fileId', reason: 'Missing fileId for update.' }],
          message: 'Missing fileId for update.',
        },
        { status: 400 }
      );
    }

    await createObservatoryLayoutStore().save(fileId, validation.layout);
    const entries = await createObservatoryLayoutStore().readLibrary();

    return NextResponse.json({
      entry: entries.find((entry) => entry.fileId === fileId) ?? {
        fileId,
        fileName: `${fileId}.json`,
        layout: validation.layout,
      },
      entries,
      message:
        body.mode === 'update'
          ? 'Updated layout in server storage.'
          : 'Saved new layout in server storage.',
      summaries: entries.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [
          {
            path: 'layoutLibrary',
            reason: error instanceof Error ? error.message : 'Unable to save layout snapshot.',
          },
        ],
        message: error instanceof Error ? error.message : 'Unable to save layout snapshot.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { fileId?: string };

    if (!body.fileId) {
      return NextResponse.json(
        {
          issues: [{ path: 'fileId', reason: 'Missing fileId.' }],
          message: 'Missing fileId.',
        },
        { status: 400 }
      );
    }

    await createObservatoryLayoutStore().remove(body.fileId);
    const entries = await createObservatoryLayoutStore().readLibrary();

    return NextResponse.json({
      entries,
      message: 'Removed saved layout. You can restore it.',
      removedFileId: body.fileId,
      summaries: entries.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [
          {
            path: 'layoutLibrary',
            reason: error instanceof Error ? error.message : 'Unable to delete layout snapshot.',
          },
        ],
        message: error instanceof Error ? error.message : 'Unable to delete layout snapshot.',
      },
      { status: 500 }
    );
  }
}

function resolveLayoutFileId(
  providedFileId: string | undefined,
  providedName: string | undefined,
  layout: ObservatoryLayoutDocument,
  existingEntries: ObservatoryLayoutLibraryEntry[],
  mode: 'create' | 'update'
) {
  const baseId = sanitizeLayoutFileId(
    providedFileId ??
      providedName ??
      layout.metadata?.name ??
      layout.metadata?.id ??
      layout.world.name ??
      layout.world.id
  );

  if (mode === 'update') {
    return baseId;
  }

  const existingIds = new Set(existingEntries.map((entry) => entry.fileId));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  let candidate = `${baseId}-${counter}`;

  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = `${baseId}-${counter}`;
  }

  return candidate;
}

function sanitizeLayoutFileId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized || `layout-${Date.now()}`;
}
