"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState("sign-in/email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const query = new URLSearchParams(location.search);
      const body =
        mode === "reset-password"
          ? { newPassword: form.get("password"), token: query.get("token") }
          : {
              email: form.get("email"),
              password: form.get("password"),
              name: form.get("name"),
              redirectTo: "/sign-in",
            };
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json();
        setMessage(
          response.status === 503
            ? data.message
            : "Unable to complete request. Check your details or try again later.",
        );
      } else if (mode === "request-password-reset")
        setMessage("If an account exists, check your email for the reset link.");
      else if (mode === "reset-password") setMessage("Password updated. You can now sign in.");
      else router.push("/dashboard");
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <nav>
        {[
          ["sign-in/email", "Sign in"],
          ["sign-up/email", "Create account"],
          ["request-password-reset", "Forgot password"],
          ["reset-password", "Reset with email link"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setMode(value!);
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <form action={submit}>
        {mode === "sign-up/email" && (
          <label>
            Name <input name="name" required maxLength={200} autoComplete="name" />
          </label>
        )}
        {mode !== "reset-password" && (
          <label>
            Email <input name="email" type="email" required autoComplete="email" />
          </label>
        )}
        {mode !== "request-password-reset" && (
          <label>
            Password{" "}
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={mode === "sign-in/email" ? "current-password" : "new-password"}
            />
          </label>
        )}
        <button disabled={busy}>{busy ? "Working…" : "Continue"}</button>
      </form>
      <p role="status">{message}</p>
      <p>
        Email delivery is not configured. Email verification and recovery require administrator
        setup.
      </p>
    </>
  );
}
