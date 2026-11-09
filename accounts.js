import { createClient } from "@supabase/supabase-js";
import { validateScene } from "./scene.js";

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const buildEnvironment = import.meta.env || {};

export function getAuthRedirectUrl(page = "account.html") {
  const configuredSiteUrl = buildEnvironment.VITE_PUBLIC_SITE_URL || "";
  let baseUrl;
  try {
    baseUrl = new URL(configuredSiteUrl || window.location.origin);
  } catch {
    return undefined;
  }
  if (baseUrl.protocol !== "https:" &&
      !(baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname))) {
    return undefined;
  }
  return new URL(page, `${baseUrl.origin}/`).toString();
}

function isAllowedSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function isPublicSupabaseKey(value) {
  if (value.startsWith("sb_secret_")) return false;
  const payload = value.split(".")[1];
  if (!payload) return true;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role !== "service_role";
  } catch {
    return true;
  }
}

export function createSupabaseClient({
  url = buildEnvironment.VITE_SUPABASE_URL || "",
  anonKey = buildEnvironment.VITE_SUPABASE_ANON_KEY || ""
} = {}) {
  if (!url && !anonKey) return null;
  if (!isAllowedSupabaseUrl(url) || !anonKey || !isPublicSupabaseKey(anonKey)) {
    throw new Error("Supabase settings are invalid. Set VITE_SUPABASE_URL and a publishable/anon key, never a service-role key.");
  }
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });
}

export function watchAuthState(client, onChange) {
  if (!client) {
    onChange(null, null);
    return () => {};
  }

  let disposed = false;
  let lastUserId;
  let hasInitialState = false;
  const notify = (session, error, event = "INITIAL_SESSION") => {
    if (disposed) return;
    const userId = session?.user?.id || null;
    if (!error && hasInitialState && userId === lastUserId &&
        event !== "PASSWORD_RECOVERY" && event !== "USER_UPDATED") return;
    hasInitialState = true;
    lastUserId = userId;
    onChange(session, error, event);
  };
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    queueMicrotask(() => notify(session, null, event));
  });
  client.auth.getSession().then(({ data, error }) => {
    notify(data?.session || null, error || null, "INITIAL_SESSION");
  }).catch((error) => {
    notify(null, error, "INITIAL_SESSION");
  });
  return () => {
    disposed = true;
    subscription.unsubscribe();
  };
}

function normalizeLocalScene(item) {
  const timestamp = Number(item.createdAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("A local scene has an invalid creation date.");
  return {
    id: uuidPattern.test(item.id || "") ? item.id : crypto.randomUUID(),
    prompt: String(item.prompt || "").slice(0, 700),
    scene: validateScene(item.scene),
    created_at: new Date(timestamp).toISOString(),
    createdAt: timestamp
  };
}

export async function syncUserScenes(client, userId, localScenes) {
  if (!client || !uuidPattern.test(userId || "")) throw new Error("Sign in again before syncing scenes.");
  const { data: remoteRows, error: loadError } = await client
    .from("user_scenes")
    .select("id,user_id,prompt,scene,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (loadError) throw loadError;
  if (!Array.isArray(remoteRows)) throw new Error("The scene sync service returned an invalid response.");

  const localRows = localScenes.slice(0, 100).map(normalizeLocalScene);
  const sceneMap = new Map();
  for (const row of remoteRows) {
    if (row.user_id !== userId || !uuidPattern.test(row.id || "") ||
        typeof row.prompt !== "string" || row.prompt.length > 700) {
      throw new Error("The scene sync service returned an invalid or unauthorized scene.");
    }
    const timestamp = Date.parse(row.created_at);
    if (!Number.isFinite(timestamp)) throw new Error("The scene sync service returned a scene with an invalid date.");
    sceneMap.set(row.id, {
      id: row.id,
      prompt: row.prompt,
      scene: validateScene(row.scene),
      createdAt: timestamp
    });
  }
  for (const row of localRows) {
    const existing = sceneMap.get(row.id);
    if (!existing || row.createdAt > existing.createdAt) {
      sceneMap.set(row.id, {
        id: row.id,
        prompt: row.prompt,
        scene: row.scene,
        createdAt: row.createdAt
      });
    }
  }

  const mergedScenes = [...sceneMap.values()]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 100);
  const rowsToSave = mergedScenes.map((item) => ({
    id: item.id,
    user_id: userId,
    prompt: item.prompt,
    scene: item.scene,
    created_at: new Date(item.createdAt).toISOString()
  }));
  if (rowsToSave.length) {
    const { error: saveError } = await client
      .from("user_scenes")
      .upsert(rowsToSave, { onConflict: "id" });
    if (saveError) throw saveError;
  }
  return mergedScenes;
}
