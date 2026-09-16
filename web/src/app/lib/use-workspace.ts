"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessProfile, Campaign } from "../types/marketpilot";
import { defaultProfile } from "./storage";
import { validCampaigns, validProfile } from "./validation";

type SaveState = "saved" | "saving" | "error" | "conflict";
type Snapshot = { profile: BusinessProfile; campaigns: Campaign[] };

export function useWorkspace(userId: string) {
  const [profile, setProfile] = useState(defaultProfile);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const revision = useRef(0);
  const lastSaved = useRef("");
  const latest = useRef<Snapshot>({ profile: defaultProfile, campaigns: [] });
  const running = useRef<Promise<boolean> | null>(null);
  const conflict = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]), headers: { "x-marketpilot-user": userId } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load your workspace.");
        if (!validProfile(data.profile) || !validCampaigns(data.campaigns) || !Number.isInteger(data.revision)) throw new Error("Cloud workspace returned invalid data.");
        if (!mounted.current) return;
        revision.current = data.revision;
        latest.current = { profile: data.profile, campaigns: data.campaigns };
        lastSaved.current = JSON.stringify(latest.current);
        setSavedSnapshot(lastSaved.current);
        setProfile(data.profile); setCampaigns(data.campaigns); setReady(true);
      } catch (error) {
        if (!abort.signal.aborted && mounted.current) setLoadError(error instanceof Error ? error.message : "Unable to load your workspace.");
      }
    }
    void load();
    return () => { mounted.current = false; abort.abort(); };
  }, [userId]);

  const flush = useCallback((): Promise<boolean> => {
    if (running.current) return running.current;
    if (!ready || conflict.current) return Promise.resolve(false);
    const save = async () => {
      try {
        while (JSON.stringify(latest.current) !== lastSaved.current) {
          if (mounted.current) { setSaveState("saving"); setSaveError(""); }
          const snapshot = JSON.stringify(latest.current);
          const response = await fetch("/api/workspace", {
            method: "PUT", headers: { "Content-Type": "application/json", "x-marketpilot-user": userId },
            body: JSON.stringify({ ...JSON.parse(snapshot), revision: revision.current }),
            signal: AbortSignal.timeout(30000),
          });
          const data = await response.json();
          if (!response.ok) {
            if (response.status === 409) conflict.current = true;
            throw new Error(data.error || "Cloud save failed. Please retry.");
          }
          if (!Number.isInteger(data.revision)) throw new Error("Cloud save could not be confirmed. Export a backup before reloading.");
          revision.current = data.revision;
          lastSaved.current = snapshot;
          if (mounted.current) setSavedSnapshot(snapshot);
        }
        if (mounted.current) setSaveState("saved");
        return true;
      } catch (error) {
        if (mounted.current) {
          setSaveState(conflict.current ? "conflict" : "error");
          setSaveError(error instanceof Error ? error.message : "Cloud save failed.");
        }
        return false;
      }
    };
    running.current = save().finally(() => { running.current = null; });
    return running.current;
  }, [ready, userId]);

  useEffect(() => {
    latest.current = { profile, campaigns };
    if (!ready || JSON.stringify(latest.current) === lastSaved.current || conflict.current) return;
    const timer = setTimeout(() => { void flush(); }, 600);
    return () => clearTimeout(timer);
  }, [profile, campaigns, ready, flush]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (ready && JSON.stringify(latest.current) !== lastSaved.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [ready]);

  // flush() also sees edits made before the debounce effect runs.
  const flushNow = () => { latest.current = { profile, campaigns }; return flush(); };
  const pending = ready && JSON.stringify({ profile, campaigns }) !== savedSnapshot;
  return { profile, setProfile, campaigns, setCampaigns, ready, loadError, saveError, saveState, pending, flush: flushNow };
}
