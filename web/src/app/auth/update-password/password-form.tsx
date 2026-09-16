"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { browserSupabase } from "../../lib/supabase/client";

export default function PasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      const { error } = await browserSupabase().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Password update failed."); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="card auth-card"><p className="eyebrow">MARKETPILOT</p><h1>Choose a new password</h1>
    {message && <p className="auth-message" role="status">{message}</p>}
    <form onSubmit={submit}>
      <label className="field"><span>New password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} disabled={busy} onChange={e => setPassword(e.target.value)}/></label>
      <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)}/></label>
      <button className="primary wide" disabled={busy}>{busy ? "Saving..." : "Save password"}</button>
    </form><Link className="auth-back" href="/">Back to workspace</Link>
  </section></main>;
}
