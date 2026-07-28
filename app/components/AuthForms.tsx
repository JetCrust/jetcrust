"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthForms() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    try {
      if (mode === "signup") {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fd.get("name"), email, password }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Could not create your account.");
          setBusy(false);
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Those details did not match. Please try again.");
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.8rem", justifyContent: "center" }}>
        <button className="textlink" style={{ color: mode === "signin" ? "var(--brass)" : "var(--ink)" }} onClick={() => setMode("signin")}>Sign In</button>
        <button className="textlink" style={{ color: mode === "signup" ? "var(--brass)" : "var(--ink)" }} onClick={() => setMode("signup")}>Create Account</button>
      </div>
      <form className="ef" onSubmit={submit}>
        {mode === "signup" && (
          <div className="full"><label>Full name</label><input name="name" type="text" required /></div>
        )}
        <div className="full"><label>Email</label><input name="email" type="email" required /></div>
        <div className="full"><label>Password</label><input name="password" type="password" minLength={8} required /></div>
        {error && <p className="full" style={{ color: "#a3412e", margin: 0, fontSize: "0.9rem" }}>{error}</p>}
        <div className="full">
          <button className="btn btn--brass" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
