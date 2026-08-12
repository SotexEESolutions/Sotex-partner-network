"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">S</div>
        <h1>SoTex Partner Network</h1>
        <p className="sub">Sign in with your internal account to continue.</p>
        <form onSubmit={submit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@sotex.example"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="primary auth-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-footnote">Accounts are provisioned internally. Contact your administrator for access.</p>
      </div>
    </div>
  );
}
