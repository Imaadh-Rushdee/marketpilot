import type { NextConfig } from "next";

// Reject privileged keys before Next.js can embed a NEXT_PUBLIC_ value in assets.
for (const publicKey of [process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY]) {
  if (publicKey?.startsWith("sb_secret_")) throw new Error("Use a Supabase publishable key, never a secret key, in NEXT_PUBLIC_ variables.");
  if (publicKey?.startsWith("eyJ")) {
    let role;
    try { role = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString()).role; } catch { /* Rejected below. */ }
    if (role !== "anon") throw new Error("Public Supabase variables must use an anon/publishable key, never a service-role key.");
  }
}

const nextConfig: NextConfig = {
  distDir: process.env.MARKETPILOT_TEST_DIST_DIR || ".next",
};

export default nextConfig;
