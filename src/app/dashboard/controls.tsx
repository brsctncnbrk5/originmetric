"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Request failed.");
  return data;
}
export function AccountControls({ email }: { email: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<
    { token: string; createdAt: string; expiresAt: string }[]
  >([]);
  async function showSessions() {
    try {
      const response = await fetch("/api/auth/list-sessions", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load sessions.");
      setSessions(await response.json());
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function revoke(token: string) {
    try {
      await post("/api/auth/revoke-session", { token });
      setMessage("Session revoked.");
      await showSessions();
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function act(action: string) {
    try {
      await post(
        `/api/auth/${action}`,
        action === "send-verification-email" ? { email, callbackURL: "/dashboard" } : {},
      );
      if (action === "sign-out") router.push("/sign-in");
      else
        setMessage(
          action === "send-verification-email"
            ? "Verification email sent."
            : "Other sessions revoked.",
        );
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <>
      <button onClick={() => act("sign-out")}>Sign out</button>
      <button onClick={() => act("revoke-other-sessions")}>Sign out other sessions</button>
      <button onClick={() => act("send-verification-email")}>Verify email</button>
      <button onClick={showSessions}>Manage sessions</button>
      <ul>
        {sessions.map((session, index) => (
          <li key={session.token}>
            Session {index + 1}: created {new Date(session.createdAt).toLocaleString("en-US")},
            expires {new Date(session.expiresAt).toLocaleString("en-US")}{" "}
            <button onClick={() => revoke(session.token)}>Revoke session</button>
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
    </>
  );
}
interface Config {
  name: string;
  allowedDomains: string[];
  timezone: string;
  primaryCurrency: string;
  excludedReferrers: string[];
}
export function ProjectForm({ id, initial }: { id?: string; initial?: Config }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(form: FormData) {
    setBusy(true);
    const list = (name: string) =>
      String(form.get(name) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const config = {
      name: String(form.get("name")),
      allowedDomains: list("domains"),
      timezone: String(form.get("timezone")),
      primaryCurrency: String(form.get("currency")),
      excludedReferrers: list("exclusions"),
    };
    try {
      const result = await post(
        `/api/account/projects${id ? `/${id}` : ""}`,
        id ? { action: "update", config } : config,
      );
      if (!id) router.push(`/dashboard/projects/${result.projectId}`);
      else {
        setMessage("Settings saved.");
        router.refresh();
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Delete this project and disable its keys?")) return;
    try {
      await post(`/api/account/projects/${id}`, { action: "delete" });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <>
      <form action={submit}>
        <label>
          Project name <input name="name" required maxLength={200} defaultValue={initial?.name} />
        </label>
        <label>
          Allowed domains (comma separated){" "}
          <input
            name="domains"
            required
            defaultValue={initial?.allowedDomains.join(", ")}
            placeholder="example.com"
          />
        </label>
        <label>
          Timezone <input name="timezone" required defaultValue={initial?.timezone ?? "UTC"} />
        </label>
        <label>
          Primary currency{" "}
          <input name="currency" required defaultValue={initial?.primaryCurrency ?? "USD"} />
        </label>
        <label>
          Excluded referrers (comma separated){" "}
          <input name="exclusions" defaultValue={initial?.excludedReferrers.join(", ")} />
        </label>
        <button disabled={busy}>{id ? "Save settings" : "Create project"}</button>
      </form>
      {id && <button onClick={remove}>Delete project</button>}
      <p role="status">{message}</p>
    </>
  );
}
export function KeyControls({
  id,
  keys,
}: {
  id: string;
  keys: { id: string; prefix: string; name: string | null; revoked: boolean }[];
}) {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  async function act(action: string, keyId?: string, name?: string) {
    setBusy(true);
    setSecret("");
    try {
      const data = await post(`/api/account/projects/${id}`, { action, keyId, name });
      if (data.key) setSecret(data.key);
      setMessage("Key updated.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>Server-side only. New keys are displayed once; copy them to your secret store.</p>
      <form action={(form) => act("create-key", undefined, String(form.get("name")))}>
        <label>
          Key name <input name="name" required maxLength={100} />
        </label>
        <button disabled={busy || pending}>Create key</button>
      </form>
      {secret && (
        <p>
          Copy this key now: <code>{secret}</code>
          <button onClick={() => setSecret("")}>Dismiss</button>
        </p>
      )}
      <ul>
        {keys.map((k) => (
          <li key={k.id}>
            {k.name} · {k.prefix} ·{" "}
            {k.revoked ? (
              "Revoked"
            ) : (
              <>
                <button disabled={busy || pending} onClick={() => act("rotate-key", k.id)}>
                  Rotate
                </button>
                <button disabled={busy || pending} onClick={() => act("revoke-key", k.id)}>
                  Revoke
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
    </>
  );
}
