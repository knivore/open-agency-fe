import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextRequest, NextResponse } from 'next/server';

import {
  markObservatoryLayoutStatus,
  serializeObservatoryLayout,
} from '@/modules/observatory/engine/world/layoutPersistence';
import {
  summarizeObservatoryLayoutLibraryEntry,
  type ObservatoryLayoutLibraryEntry,
} from '@/modules/observatory/engine/world/layoutLibrary';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

const layoutsDirectoryPath = path.join(process.cwd(), 'modules', 'observatory', 'layouts', 'library');

export async function GET() {
  try {
    const entries = await readLayoutLibrary();

    return NextResponse.json({
      entries,
      summaries: entries.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [{ path: 'layoutLibrary', reason: error instanceof Error ? error.message : 'Unable to read layout library.' }],
        message: error instanceof Error ? error.message : 'Unable to read layout library.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      fileId?: string;
      layout?: ObservatoryLayoutDocument;
      mode?: 'create' | 'update';
      name?: string;
      notes?: string;
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

    const preparedLayout = markObservatoryLayoutStatus(
      {
        ...body.layout,
        metadata: {
          ...body.layout.metadata,
          ...(body.name?.trim() ? { name: body.name.trim() } : {}),
          ...(body.notes !== undefined ? { notes: body.notes.trim() || undefined } : {}),
        },
      },
      'draft',
    );
    const validation = validateObservatoryLayout(preparedLayout);

    if (!validation.layout) {
      return NextResponse.json(
        {
          issues: validation.issues,
          message: 'Saved layout failed validation.',
        },
        { status: 400 },
      );
    }

    await mkdir(layoutsDirectoryPath, { recursive: true });
    const existingEntries = await readLayoutLibrary();
    const fileId = resolveLayoutFileId(body.fileId, body.name, validation.layout, existingEntries, body.mode ?? 'create');
    const targetPath = path.join(layoutsDirectoryPath, `${fileId}.json`);

    if (body.mode === 'update' && !body.fileId) {
      return NextResponse.json(
        {
          issues: [{ path: 'fileId', reason: 'Missing fileId for update.' }],
          message: 'Missing fileId for update.',
        },
        { status: 400 },
      );
    }

    await writeFile(targetPath, `${serializeObservatoryLayout(validation.layout)}\n`, 'utf8');
    const entries = await readLayoutLibrary();

    return NextResponse.json({
      entry: entries.find((entry) => entry.fileId === fileId) ?? {
        fileId,
        fileName: `${fileId}.json`,
        layout: validation.layout,
      },
      entries,
      message: body.mode === 'update' ? 'Updated saved layout.' : 'Saved new layout.',
      summaries: entries.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [{ path: 'layoutLibrary', reason: error instanceof Error ? error.message : 'Unable to save layout snapshot.' }],
        message: error instanceof Error ? error.message : 'Unable to save layout snapshot.',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { fileId?: string };

    if (!body.fileId) {
      return NextResponse.json(
        {
          issues: [{ path: 'fileId', reason: 'Missing fileId.' }],
          message: 'Missing fileId.',
        },
        { status: 400 },
      );
    }

    await unlink(path.join(layoutsDirectoryPath, `${sanitizeLayoutFileId(body.fileId)}.json`));
    const entries = await readLayoutLibrary();

    return NextResponse.json({
      entries,
      message: 'Deleted saved layout.',
      summaries: entries.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        issues: [{ path: 'layoutLibrary', reason: error instanceof Error ? error.message : 'Unable to delete layout snapshot.' }],
        message: error instanceof Error ? error.message : 'Unable to delete layout snapshot.',
      },
      { status: 500 },
    );
  }
}

async function readLayoutLibrary(): Promise<ObservatoryLayoutLibraryEntry[]> {
  await mkdir(layoutsDirectoryPath, { recursive: true });
  const fileNames = (await readdir(layoutsDirectoryPath)).filter((fileName) => fileName.endsWith('.json'));
  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const fileId = fileName.replace(/\.json$/u, '');
      const source = await readFile(path.join(layoutsDirectoryPath, fileName), 'utf8');
      const validation = validateObservatoryLayout(JSON.parse(source));

      if (!validation.layout) {
        throw new Error(`Saved layout ${fileName} failed validation.`);
      }

      return {
        fileId,
        fileName,
        layout: validation.layout,
      };
    }),
  );

  return entries.sort((left, right) => {
    const leftTime = Date.parse(left.layout.metadata?.updatedAt ?? left.layout.metadata?.createdAt ?? '') || 0;
    const rightTime = Date.parse(right.layout.metadata?.updatedAt ?? right.layout.metadata?.createdAt ?? '') || 0;
    return rightTime - leftTime;
  });
}

function resolveLayoutFileId(
  providedFileId: string | undefined,
  providedName: string | undefined,
  layout: ObservatoryLayoutDocument,
  existingEntries: ObservatoryLayoutLibraryEntry[],
  mode: 'create' | 'update',
) {
  const baseId = sanitizeLayoutFileId(
    providedFileId
    ?? providedName
    ?? layout.metadata?.name
    ?? layout.metadata?.id
    ?? layout.world.name
    ?? layout.world.id,
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
