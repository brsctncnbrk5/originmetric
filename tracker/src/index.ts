import {
  campaignKey,
  capUtm,
  screenClass,
  shouldStartNewSession,
  type CampaignParts,
  type StoredSession,
} from "./core";

type OriginMetricCall = [string, unknown?];

interface OriginMetricApi {
  (command: string, value?: unknown): void;
  q?: OriginMetricCall[];
  version: string;
  getVisitorId(): string | null;
}

declare global {
  interface Window {
    originmetric?: OriginMetricApi;
  }

  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

const VID = "om_vid";
const VID_EXP = "om_vid_exp";
const SES = "om_ses";
const VISITOR_MAX_AGE = 13 * 30 * 24 * 60 * 60;
const SESSION_MAX_AGE = 30 * 60;

try {
  const script = document.currentScript as HTMLScriptElement | null;
  const site = script?.dataset.site ?? "";
  const domainValue = script?.dataset.domain?.replace(/^\./, "");
  const cookieDomain =
    domainValue && /^[A-Za-z0-9.-]+$/.test(domainValue) ? domainValue.toLowerCase() : null;
  const required = script?.dataset.consent === "required";
  const ignoreGpc = script?.dataset.gpc === "ignore";
  const debug = script?.dataset.debug === "true";
  const gpc = !ignoreGpc && navigator.globalPrivacyControl === true;
  const endpoint = script?.src ? new URL("/api/v1/e", script.src).toString() : "/api/v1/e";
  const queued = typeof window.originmetric === "function" ? (window.originmetric.q ?? []) : [];

  let enabled = !required && !gpc;
  let landing = readCampaign();
  let lastUrl = "";
  let lastSentAt = 0;

  function report(error: unknown) {
    if (debug) console.warn("OriginMetric tracker error", error);
  }

  function readCookie(name: string): string | null {
    const prefix = `${name}=`;
    for (const part of document.cookie.split(";")) {
      const value = part.trim();
      if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
    }
    return null;
  }

  function cookieLine(name: string, value: string, maxAge: number, domain: string | null): string {
    return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}${
      domain ? `; Domain=${domain}` : ""
    }`;
  }

  function writeStorage(name: string, value: string, maxAge: number): boolean {
    try {
      document.cookie = cookieLine(name, value, maxAge, cookieDomain);
      if (readCookie(name) === value) return true;
    } catch (error) {
      report(error);
    }
    try {
      localStorage.setItem(name, value);
      return localStorage.getItem(name) === value;
    } catch (error) {
      report(error);
      return false;
    }
  }

  function readStorage(name: string): string | null {
    try {
      const cookie = readCookie(name);
      if (cookie !== null) return cookie;
    } catch (error) {
      report(error);
    }
    try {
      return localStorage.getItem(name);
    } catch (error) {
      report(error);
      return null;
    }
  }

  function deleteCookie(name: string, domain: string | null) {
    try {
      document.cookie = cookieLine(name, "", 0, domain);
    } catch (error) {
      report(error);
    }
  }

  function clearState() {
    try {
      const names = new Set([VID, SES]);
      for (const part of document.cookie.split(";")) {
        const name = part.split("=")[0]?.trim();
        if (name?.startsWith("om_")) names.add(name);
      }
      for (const name of names) {
        deleteCookie(name, null);
        if (cookieDomain) deleteCookie(name, cookieDomain);
        if (location.hostname !== cookieDomain) deleteCookie(name, location.hostname);
      }
    } catch (error) {
      report(error);
    }
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith("om_")) localStorage.removeItem(key);
      }
    } catch (error) {
      report(error);
    }
  }

  function readVisitor(): string | null {
    const fromCookie = readCookie(VID);
    if (fromCookie) return fromCookie;
    try {
      const id = localStorage.getItem(VID);
      const expires = Number(localStorage.getItem(VID_EXP));
      if (!id || !Number.isFinite(expires) || Date.now() >= expires) {
        localStorage.removeItem(VID);
        localStorage.removeItem(VID_EXP);
        return null;
      }
      return id;
    } catch (error) {
      report(error);
      return null;
    }
  }

  function ensureVisitor(): string | null {
    const current = readVisitor();
    if (current) return current;
    const id = crypto.randomUUID();
    if (writeStorage(VID, id, VISITOR_MAX_AGE)) {
      if (readCookie(VID) === null) {
        try {
          localStorage.setItem(VID_EXP, String(Date.now() + VISITOR_MAX_AGE * 1000));
        } catch (error) {
          report(error);
          return null;
        }
      }
      return id;
    }
    return null;
  }

  function readSession(): StoredSession | null {
    const raw = readStorage(SES);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<StoredSession>;
      return typeof value.id === "string" &&
        typeof value.lastActivity === "number" &&
        typeof value.campaignKey === "string"
        ? { id: value.id, lastActivity: value.lastActivity, campaignKey: value.campaignKey }
        : null;
    } catch {
      return null;
    }
  }

  function ownHost(host: string): boolean {
    const base = cookieDomain ?? location.hostname.toLowerCase();
    return host === base || host.endsWith(`.${base}`);
  }

  function readCampaign(): CampaignParts & { key: string } {
    const params = new URLSearchParams(location.search);
    let referrerHost: string | null = null;
    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : null;
    } catch {
      referrerHost = null;
    }
    const parts: CampaignParts = {
      utmSource: capUtm(params.get("utm_source")),
      utmMedium: capUtm(params.get("utm_medium")),
      utmCampaign: capUtm(params.get("utm_campaign")),
      utmContent: capUtm(params.get("utm_content")),
      utmTerm: capUtm(params.get("utm_term")),
      referrerHost,
      gclid: params.has("gclid"),
      fbclid: params.has("fbclid"),
      msclkid: params.has("msclkid"),
    };
    return { ...parts, key: campaignKey(parts, !!referrerHost && !ownHost(referrerHost)) };
  }

  function send(payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    try {
      if (
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }))
      ) {
        return;
      }
    } catch (error) {
      report(error);
    }
    try {
      void fetch(endpoint, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "omit",
        headers: { "content-type": "text/plain" },
      }).catch(report);
    } catch (error) {
      report(error);
    }
  }

  function pageview() {
    try {
      if (!enabled || gpc || !/^pk_[0-9A-Za-z]{22}$/.test(site)) return;
      const href = location.href;
      const now = Date.now();
      if (href === lastUrl && now - lastSentAt < 1000) return;

      const visitorId = ensureVisitor();
      if (!visitorId) return;

      const entry = landing ?? readCampaign();
      let session = readSession();
      const newSession = shouldStartNewSession(session, now, entry.key);
      if (newSession) {
        session = { id: crypto.randomUUID(), lastActivity: now, campaignKey: entry.key };
      } else if (session) {
        session.lastActivity = now;
      }
      if (!session || !writeStorage(SES, JSON.stringify(session), SESSION_MAX_AGE)) return;

      const payload: Record<string, unknown> = {
        site_key: site,
        type: "pageview",
        event_id: crypto.randomUUID(),
        visitor_id: visitorId,
        session_id: session.id,
        path: location.pathname || "/",
        screen_class: screenClass(innerWidth),
      };
      if (newSession) {
        if (entry.referrerHost) payload.referrer_host = entry.referrerHost;
        if (entry.utmSource !== null) payload.utm_source = entry.utmSource;
        if (entry.utmMedium !== null) payload.utm_medium = entry.utmMedium;
        if (entry.utmCampaign !== null) payload.utm_campaign = entry.utmCampaign;
        if (entry.utmContent !== null) payload.utm_content = entry.utmContent;
        if (entry.utmTerm !== null) payload.utm_term = entry.utmTerm;
        if (entry.gclid) payload.gclid = true;
        if (entry.fbclid) payload.fbclid = true;
        if (entry.msclkid) payload.msclkid = true;
      }

      landing = null;
      lastUrl = href;
      lastSentAt = now;
      send(payload);
    } catch (error) {
      report(error);
    }
  }

  const api = ((command: string, value?: unknown) => {
    try {
      if (command !== "consent") return;
      if (value === false) {
        enabled = false;
        clearState();
        return;
      }
      if (value === true && !gpc) {
        enabled = true;
        pageview();
      }
    } catch (error) {
      report(error);
    }
  }) as OriginMetricApi;
  api.version = "0.1.0";
  api.getVisitorId = () => (enabled && !gpc ? readVisitor() : null);
  window.originmetric = api;

  for (const call of queued) {
    if (Array.isArray(call) && typeof call[0] === "string") api(call[0], call[1]);
  }

  if (enabled) pageview();

  const navigate = () => setTimeout(pageview, 0);
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<History[typeof method]>) {
      const result = original.apply(this, args);
      navigate();
      return result;
    } as History[typeof method];
  }
  addEventListener("popstate", navigate);
} catch {
  // Failure isolation is the contract: the tracker must never break the host page.
}

export {};
