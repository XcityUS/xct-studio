import { byteplusPortraitConfigured } from '@/lib/server/byteplus-openapi';
import { NextResponse } from 'next/server';

export type PortraitAuth = {
    bearer: string;
    userId: string;
};

export type PortraitRouteGate =
    | {
          auth: PortraitAuth;
      }
    | {
          response: NextResponse;
      };

function tokenHubBaseUrl(): string {
    return (process.env.TOKENHUB_URL || 'https://tokenhub.xcity.one').trim().replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function ownerTag(userId: string): string {
    return `xcity:${userId}`;
}

export function jsonError(error: string, status: number): NextResponse {
    return NextResponse.json({ error }, { status });
}

export async function requirePortraitRoute(
    request: Request,
    options: { allowUnconfigured?: boolean } = {}
): Promise<PortraitRouteGate> {
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!bearer) {
        return { response: jsonError('missing bearer token', 401) };
    }

    let body: unknown;
    try {
        const res = await fetch(`${tokenHubBaseUrl()}/key/info`, {
            headers: { Authorization: `Bearer ${bearer}` },
            cache: 'no-store'
        });
        if (!res.ok) {
            return { response: jsonError('invalid or unauthorized key', 401) };
        }
        body = (await res.json().catch(() => ({}))) as unknown;
    } catch {
        return { response: jsonError('invalid or unauthorized key', 401) };
    }

    const info = isRecord(body) ? body.info : null;
    const userId = isRecord(info) && typeof info.user_id === 'string' ? info.user_id.trim() : '';
    if (!userId) {
        return { response: jsonError('invalid or unauthorized key', 401) };
    }

    if (!options.allowUnconfigured && !byteplusPortraitConfigured()) {
        return { response: jsonError('portrait library not configured', 503) };
    }

    return { auth: { bearer, userId } };
}

export function responseJson(value: unknown): NextResponse {
    return NextResponse.json(value);
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

export function resultRoot(payload: unknown): Record<string, unknown> {
    const record = readRecord(payload) ?? {};
    const result = readRecord(record.Result);
    return result ?? record;
}

export function stringField(record: Record<string, unknown>, ...names: string[]): string {
    for (const name of names) {
        const value = record[name];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

export function arrayField(record: Record<string, unknown>, ...names: string[]): unknown[] {
    for (const name of names) {
        const value = record[name];
        if (Array.isArray(value)) return value;
    }
    return [];
}
