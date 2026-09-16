export default function SetupNotice() {
  return <main className="auth-shell"><section className="card auth-card">
    <p className="eyebrow">MARKETPILOT</p><h1>Workspace setup required</h1>
    <p className="muted">The cloud workspace is not connected yet. Add your Supabase project URL and publishable key to the app environment, apply the database migration, then restart or redeploy.</p>
    <p className="muted">Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Never use a service-role key.</p>
  </section></main>;
}
