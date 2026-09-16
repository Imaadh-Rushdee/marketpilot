"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Logo from "../assets/logo.png";
import { Loader2 } from "lucide-react";
import { browserSupabase } from "../lib/supabase/client";

import { defaultProfile } from "../lib/storage";

type Mode = "login" | "signup" | "reset";
export default function AuthForm({ initialMessage }: { initialMessage: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [business, setBusiness] = useState({ name: "", description: "", businessType: "", expectedOutcome: "", keywords: "", phone: "", whatsapp: "", email: "", address: "", socialHandles: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (mode === "signup" && password !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setBusy(true);
    try {
      const supabase = browserSupabase();
      const callback = `${window.location.origin}/auth/callback`;
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${callback}?next=/auth/update-password` });
        if (error) throw error;
        setMessage("If this email has an account, a password reset link will arrive shortly.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback, data: { business_profile: { ...defaultProfile, services: "", audience: "", ...business } } } });
        if (error) throw error;
        if (data.session) { router.replace("/app"); router.refresh(); }
        else setMessage("Check your email to confirm your account, then sign in. Check spam if the message does not arrive.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/app"); router.refresh();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete authentication. Please retry."); }
    finally { setBusy(false); }
  }

  const changeMode = (next: Mode) => { setMode(next); setMessage(""); setPassword(""); setConfirmPassword(""); };
  return <main className="auth-shell"><section className="card auth-card">
    <Image className="auth-logo" src={Logo} alt="MarketPilot" priority />
    <p className="eyebrow">YOUR MARKETING WORKSPACE</p>
    <h1>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back"}</h1>
    <p className="muted">{mode === "reset" ? "We will email you a link to choose a new password." : "Plan, create and save your campaigns in your private cloud workspace."}</p>
    {message && <p className="auth-message" role="status">{message}</p>}
    <form onSubmit={submit}>
      <label className="field"><span>Email</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/></label>
      {mode !== "reset" && <label className="field"><span>Password</span><input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : 1} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label>}
      {mode === "signup" && <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={busy}/></label>}
      {mode === "signup" && <fieldset className="onboarding-fields"><legend>About your business</legend>{([
        ["name", "Business name"], ["businessType", "Business type"], ["description", "What does your business do?"], ["expectedOutcome", "What do you want to achieve?"], ["phone", "Phone number (optional)"], ["whatsapp", "WhatsApp number (optional)"], ["email", "Business email (optional)"], ["address", "Business address (optional)"], ["socialHandles", "Social media names (optional)"], ["keywords", "Business keywords (optional)"]
      ] as const).map(([key,label]) => <label className="field" key={key}><span>{label}</span><input required={["name","businessType","description","expectedOutcome"].includes(key)} maxLength={1000} value={business[key]} onChange={e => setBusiness({...business,[key]:e.target.value})} disabled={busy}/></label>)}</fieldset>}
      <button className="primary wide" type="submit" disabled={busy}>{busy && <Loader2 className="spin" size={18}/>} {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
    </form>
    <div className="auth-links">
      <button className="text-btn" disabled={busy} onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Back to sign in"}</button>
      {mode === "login" && <button className="text-btn" disabled={busy} onClick={() => changeMode("reset")}>Forgot password?</button>}
    </div>
  </section></main>;
}
