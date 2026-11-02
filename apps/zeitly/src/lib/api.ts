import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'Ungültiger Request-Body.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'Eingaben unvollständig oder ungültig.', parsed.error.flatten());
  return parsed.data;
}

/** Wrap a route handler: maps ApiError → JSON, logs unexpected errors. */
export function handler(fn: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Record<string, string> }): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.message, e.details);
      console.error('[api]', req.method, new URL(req.url).pathname, e);
      return fail(500, 'Interner Fehler.');
    }
  };
}

export const unauthorized = () => fail(401, 'Nicht angemeldet.');
export const forbidden = () => fail(403, 'Keine Berechtigung.');
