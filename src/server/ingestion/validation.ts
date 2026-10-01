import { z } from "zod";
import { normalizeHost } from "@/server/attribution/source";

const UUID = z.string().uuid();
const SITE_KEY = /^pk_[0-9A-Za-z]{22}$/;
const CONTROL = /[\p{Cc}\p{Cf}]/u;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !CONTROL.test(value))
    .nullable()
    .optional();

const hostField = z
  .string()
  .max(253)
  .transform((value, ctx) => {
    const host = normalizeHost(value);
    if (host === null) {
      ctx.addIssue({ code: "custom", message: "invalid referrer host" });
      return z.NEVER;
    }
    return host;
  })
  .nullable()
  .optional();

export const browserEventSchema = z.strictObject({
  site_key: z.string().regex(SITE_KEY),
  type: z.literal("pageview"),
  event_id: UUID,
  visitor_id: UUID,
  session_id: UUID,
  path: z
    .string()
    .min(1)
    .max(2048)
    .refine(
      (value) =>
        value.startsWith("/") &&
        !value.includes("?") &&
        !value.includes("#") &&
        !CONTROL.test(value),
    ),
  referrer_host: hostField,
  utm_source: optionalText(200),
  utm_medium: optionalText(200),
  utm_campaign: optionalText(200),
  utm_content: optionalText(200),
  utm_term: optionalText(200),
  gclid: z.boolean().optional(),
  fbclid: z.boolean().optional(),
  msclkid: z.boolean().optional(),
  screen_class: z.enum(["mobile", "tablet", "desktop"]),
});

export interface BrowserEventInput {
  siteKey: string;
  eventId: string;
  visitorId: string;
  sessionId: string;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: boolean;
  fbclid: boolean;
  msclkid: boolean;
  screenClass: "mobile" | "tablet" | "desktop";
}

export function parseBrowserEvent(value: unknown): BrowserEventInput | null {
  const parsed = browserEventSchema.safeParse(value);
  if (!parsed.success) return null;
  const event = parsed.data;
  return {
    siteKey: event.site_key,
    eventId: event.event_id,
    visitorId: event.visitor_id,
    sessionId: event.session_id,
    path: event.path,
    referrerHost: event.referrer_host ?? null,
    utmSource: event.utm_source ?? null,
    utmMedium: event.utm_medium ?? null,
    utmCampaign: event.utm_campaign ?? null,
    utmContent: event.utm_content ?? null,
    utmTerm: event.utm_term ?? null,
    gclid: event.gclid ?? false,
    fbclid: event.fbclid ?? false,
    msclkid: event.msclkid ?? false,
    screenClass: event.screen_class,
  };
}
