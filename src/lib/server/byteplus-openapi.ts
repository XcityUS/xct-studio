import { createHash, createHmac } from 'node:crypto';

const API_VERSION = '2024-01-01';
const SERVICE = 'ark';
const REQUEST_TYPE = 'request';
const SIGNED_HEADERS = 'content-type;host;x-content-sha256;x-date';

function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
    return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
    return createHmac('sha256', key).update(value).digest('hex');
}

function utcTimestamp(date = new Date()): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function envValue(name: string, fallback = ''): string {
    return (process.env[name] || fallback).trim();
}

function projectName(): string {
    return envValue('ARK_PROJECT_NAME', 'default') || 'default';
}

export function byteplusPortraitConfigured(): boolean {
    return Boolean(envValue('BYTEPLUS_AK') && envValue('BYTEPLUS_SK'));
}

function signedRequestHeaders(input: {
    action: string;
    bodyText: string;
    accessKey: string;
    secretKey: string;
    region: string;
    host: string;
    xDate: string;
}): HeadersInit {
    const payloadHash = sha256Hex(input.bodyText);
    const date = input.xDate.slice(0, 8);
    const canonicalQuery = `Action=${encodeURIComponent(input.action)}&Version=${encodeURIComponent(API_VERSION)}`;
    const canonicalHeaders =
        `content-type:application/json\n` +
        `host:${input.host}\n` +
        `x-content-sha256:${payloadHash}\n` +
        `x-date:${input.xDate}\n`;
    const canonicalRequest = [
        'POST',
        '/',
        canonicalQuery,
        canonicalHeaders,
        SIGNED_HEADERS,
        payloadHash
    ].join('\n');
    const credentialScope = `${date}/${input.region}/${SERVICE}/${REQUEST_TYPE}`;
    const stringToSign = ['HMAC-SHA256', input.xDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

    const kDate = hmac(input.secretKey, date);
    const kRegion = hmac(kDate, input.region);
    const kService = hmac(kRegion, SERVICE);
    const kSigning = hmac(kService, REQUEST_TYPE);
    const signature = hmacHex(kSigning, stringToSign);

    return {
        'Content-Type': 'application/json',
        Host: input.host,
        'X-Date': input.xDate,
        'X-Content-Sha256': payloadHash,
        Authorization:
            `HMAC-SHA256 Credential=${input.accessKey}/${credentialScope}, ` +
            `SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function byteplusErrorPayload(payload: unknown): unknown {
    if (!isRecord(payload)) return null;
    const meta = payload.ResponseMetadata;
    if (!isRecord(meta)) return null;
    return meta.Error ?? null;
}

async function parseResponseBody(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { raw: text };
    }
}

export class ArkOpenApiError extends Error {
    payload: unknown;
    status: number;

    constructor(status: number, payload: unknown) {
        super(JSON.stringify(payload));
        this.name = 'ArkOpenApiError';
        this.status = status;
        this.payload = payload;
    }
}

/*
Self-check for the Volcengine/BytePlus HMAC variant:
  action=ListAssetGroups, region=ap-southeast-1, host=ark.ap-southeast-1.byteplusapi.com
  ak=test-ak, sk=test-sk, xDate=20260328T000000Z, body={"ProjectName":"default"}
must produce payloadHash=7e0a39e645f91c0fa13aea4108715f9f85a3f55f8d3e6af22c41b5b9d11fbde3,
canonicalRequestHash=bf54e4172da126c30d2018eb726dd85900cffbd799fbb42d8a4305fe3c123d40,
signature=e0ce75a786c716cb3db1e647236ec2d9cc37e410a7f54cf82cfa2b5ddf7e0b7d.
The secret is used raw; do not prepend "AWS4".
*/
export async function arkOpenApi(action: string, body: Record<string, unknown>): Promise<unknown> {
    const accessKey = envValue('BYTEPLUS_AK');
    const secretKey = envValue('BYTEPLUS_SK');
    if (!accessKey || !secretKey) {
        throw new Error('portrait library not configured');
    }

    const region = envValue('BYTEPLUS_REGION', 'ap-southeast-1') || 'ap-southeast-1';
    const host = envValue('BYTEPLUS_ARK_API_HOST', `ark.${region}.byteplusapi.com`) || `ark.${region}.byteplusapi.com`;
    const xDate = utcTimestamp();
    const bodyText = JSON.stringify({ ...body, ProjectName: projectName() });
    const canonicalQuery = `Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(API_VERSION)}`;
    const url = `https://${host}/?${canonicalQuery}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: signedRequestHeaders({
            action,
            bodyText,
            accessKey,
            secretKey,
            region,
            host,
            xDate
        }),
        body: bodyText,
        cache: 'no-store'
    });
    const payload = await parseResponseBody(res);
    if (!res.ok || byteplusErrorPayload(payload)) {
        throw new ArkOpenApiError(res.status, payload);
    }
    return payload;
}
