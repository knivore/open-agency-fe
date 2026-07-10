import { storageApi } from '@/lib/api/backend/storage';
import { NextResponse } from 'next/server';

// GET /api/file?key=xxx - Download file from S3
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const s3Key = searchParams.get('key');

    if (!s3Key) {
      return NextResponse.json(
        { message: 'S3 key is required' },
        { status: 400 },
      );
    }

    const response = await storageApi.getPresignedUrl({
      filename: s3Key,
      operation: 'download',
    });
    const url = response.url;
    return NextResponse.json({ data: url, status: 200 });
  } catch (error) {
    console.error('Failed to get download URL:', error);
    return NextResponse.json(
      { message: 'Failed to get download URL' },
      { status: 500 },
    );
  }
}

// POST /api/file - Upload file to S3
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const s3Key = formData.get('s3Key') as string;

    if (!file || !s3Key) {
      return NextResponse.json({ message: 'File and s3Key are required' }, { status: 400 });
    }

    const presignedResponse = await storageApi.getPresignedUrl({
      filename: s3Key,
      content_type: file.type,
      operation: 'upload',
    });

    const uploadResponse = await fetch(presignedResponse.url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
    }

    return NextResponse.json({ data: s3Key, status: 200 });
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json(
      { message: 'Failed to upload file' },
      { status: 500 },
    );
  }
}
