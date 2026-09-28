import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

/**
 * Keys that must never reach log output (plan §22). Matched at the top level
 * and one level deep. Request/response bodies are never passed to the logger.
 */
const SENSITIVE_KEYS = [
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "set-cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "api_key",
  "key",
  "ip",
  "remoteAddress",
  "x-forwarded-for",
  "cf-connecting-ip",
  "userAgent",
  "user-agent",
  "customer_id",
  "customerId",
  "visitor_id",
  "visitorId",
  "email",
  "body",
  "databaseUrl",
  "DATABASE_URL",
];

export const REDACT_PATHS: string[] = SENSITIVE_KEYS.flatMap((k) => {
  const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : `["${k}"]`;
  const dot = key.startsWith("[") ? key : `.${key}`;
  return [key, `*${dot}`];
});

export interface CreateLoggerOptions {
  level?: string;
  name?: string;
  /** Override the output stream (tests capture logs this way). Defaults to stdout. */
  destination?: DestinationStream;
}

/** Central logger factory. All modules obtain loggers from here (or `logger.child`). */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const config: LoggerOptions = {
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    base: options.name ? { name: options.name } : null,
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: "msg",
    redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
  };
  return options.destination ? pino(config, options.destination) : pino(config);
}

export const logger: Logger = createLogger({ name: "originmetric" });

/**
 * Loggable facts about an unexpected error: its class and, for database errors, the SQLSTATE
 * (following `cause`, since Drizzle wraps driver errors). Never the message: PostgreSQL error
 * messages and details can contain input values.
 */
export function errorFacts(err: unknown): { error_class: string; sqlstate?: string } {
  const facts: { error_class: string; sqlstate?: string } = {
    error_class: err instanceof Error ? err.name : typeof err,
  };
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current !== null && typeof current === "object"; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      facts.sqlstate = code;
      break;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return facts;
}
