import { NextResponse, type NextRequest } from 'next/server';

type AuthRouteContext = {
  params: Promise<{
    nextauth?: string[];
  }>;
};

async function authResponse(_request: NextRequest, context: AuthRouteContext) {
  const { nextauth = [] } = await context.params;
  const action = nextauth[0];

  if (action === 'session') {
    return NextResponse.json(null);
  }

  if (action === 'providers') {
    return NextResponse.json({});
  }

  if (action === 'csrf') {
    return NextResponse.json({ csrfToken: '' });
  }

  return NextResponse.json({});
}

export const GET = authResponse;
export const POST = authResponse;
