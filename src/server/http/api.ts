/**
 * Shared server-API plumbing for `/api/v1/*` secret-key endpoints: error envelope, bounded
 * JSON body reading, Zod issue mapping, and uniform 401. Never echoes request input.
 */
import type { z } from "zod";

export type ErrorCode = "unauthorized" | "invalid_request" | "idempotency_conflict" | "internal";

export interface ErrorBody {
  error: { code: ErrorCode; message?: string; field?: string };
}

export const MAX_BODY_BYTES = 16 * 1024;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** The one and only 401 body: identical for missing, malformed, unknown, wrong or revoked keys. */
export function unauthorized(): Response {
  return json(401, { error: { code: "unauthorized" } } satisfies ErrorBody);
}

export class InvalidRequest extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "InvalidRequest";
  }
}

export function invalidRequest(err: InvalidRequest): Response {
  const body: ErrorBody = { error: { code: "invalid_request", message: err.message } };
  if (err.field !== undefined) body.error.field = err.field;
  return json(422, body);
}

export function internalError(): Response {
  return json(500, { error: { code: "internal", message: "internal error; retry is safe" } });
}

/** Read and parse a JSON object body, bounded by MAX_BODY_BYTES. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new InvalidRequest(`request body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    throw new InvalidRequest(`request body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw new InvalidRequest("request body must be valid UTF-8 JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidRequest("request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/** Parse with a Zod schema; the first issue becomes a 422 with its top-level field name. */
export function parseWith<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  if (!issue) throw new InvalidRequest("invalid request");
  if (issue.code === "unrecognized_keys") {
    throw new InvalidRequest("unknown field", issue.keys[0]);
  }
  const field = typeof issue.path[0] === "string" ? issue.path[0] : undefined;
  const missing =
    field !== undefined && typeof input === "object" && input !== null && !(field in input);
  const message = missing ? "field is required" : issue.message;
  throw new InvalidRequest(message, field);
}
