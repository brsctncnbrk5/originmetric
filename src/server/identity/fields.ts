/** API field rules shared by `/api/v1/identify` and `/api/v1/revenue-events` (plan §7.1). */
import { z } from "zod";

export const MAX_CUSTOMER_ID_LENGTH = 128;

/**
 * Founder's customer ID: a stable, opaque, non-PII identifier. 1–128 printable ASCII
 * characters without whitespace. Anything containing `@` is rejected as email-looking (PII).
 */
export const customerIdField = z
  .string({ error: "customer_id must be a string" })
  .min(1, { error: "customer_id must not be empty" })
  .max(MAX_CUSTOMER_ID_LENGTH, {
    error: `customer_id must be at most ${MAX_CUSTOMER_ID_LENGTH} characters`,
  })
  .regex(/^[\x21-\x7E]+$/, { error: "customer_id must be printable ASCII without whitespace" })
  .refine((v) => !v.includes("@"), {
    error: "customer_id must be an opaque ID, not an email address",
  });

/** Visitor ID from the tracker's first-party cookie: a UUID, normalized to lowercase. */
export const visitorIdField = z
  .uuid({ error: "visitor_id must be a UUID or null" })
  .transform((v) => v.toLowerCase());
