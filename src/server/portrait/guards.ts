import { NextResponse } from 'next/server';
import 'server-only';

export type PortraitAuth = {
    bearer: string;
};

export type PortraitRouteGate =
    | {
          auth: PortraitAuth;
      }
    | {
          response: NextResponse;
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function jsonError(error: string, status: number): NextResponse {
    return NextResponse.json({ error }, { status });
}

export function requirePortraitRoute(request: Request): PortraitRouteGate {
    if (process.env.PROVIDER_ASSETS_ENABLED !== 'true') {
        return { response: jsonError('provider asset review is not configured', 503) };
    }

    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!bearer) {
        return { response: jsonError('missing bearer token', 401) };
    }

    return { auth: { bearer } };
}

export function readRecord(value: unknown): Record<string, unknown> | null {
    return isRecord(value) ? value : null;
}

export async function readJsonRecord(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const body = (await request.json()) as unknown;
        return readRecord(body);
    } catch {
        return null;
    }
}
