import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseClient, syncUserScenes, watchAuthState } from "../src/accounts.js";
import { composeOffline } from "../src/scene.js";

const userId = "11111111-1111-4111-8111-111111111111";

test("Supabase client configuration rejects service-role credentials", () => {
  const serviceRolePayload = btoa(JSON.stringify({ role: "service_role" }));
  const serviceRoleKey = `header.${serviceRolePayload}.signature`;
  assert.throws(() => createSupabaseClient({
    url: "https://example.supabase.co",
    anonKey: serviceRoleKey
  }), /never a service-role key/);
  assert.throws(() => createSupabaseClient({
    url: "https://user:password@example.supabase.co",
    anonKey: "sb_publishable_example"
  }), /settings are invalid/);
});

test("auth watcher reports password-recovery events even for the current user", async () => {
  let authListener;
  const events = [];
  const session = { user: { id: userId } };
  const client = {
    auth: {
      onAuthStateChange(listener) {
        authListener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession() {
        return Promise.resolve({ data: { session }, error: null });
      }
    }
  };
  const stop = watchAuthState(client, (_session, error, event) => {
    assert.equal(error, null);
    events.push(event);
  });
  await new Promise((resolve) => setImmediate(resolve));
  authListener("PASSWORD_RECOVERY", session);
  await new Promise((resolve) => setImmediate(resolve));
  stop();
  assert.deepEqual(events, ["INITIAL_SESSION", "PASSWORD_RECOVERY"]);
});

test("scene sync merges local scenes and refuses rows owned by another user", async () => {
  const localScene = composeOffline("A rose opening slowly", "high");
  const remoteScene = composeOffline("A silver ring turning", "medium");
  const localRow = {
    id: "22222222-2222-4222-8222-222222222222",
    prompt: "A rose opening slowly",
    scene: localScene,
    createdAt: 2000
  };
  const remoteRow = {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: userId,
    prompt: "A silver ring turning",
    scene: remoteScene,
    created_at: new Date(1000).toISOString()
  };
  let savedRows;
  const query = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: [remoteRow], error: null }); },
    upsert(rows) {
      savedRows = rows;
      return Promise.resolve({ error: null });
    }
  };
  const client = { from: () => query };
  const merged = await syncUserScenes(client, userId, [localRow]);
  assert.deepEqual(merged.map((item) => item.id), [localRow.id, remoteRow.id]);
  assert.equal(savedRows.length, 2);
  assert.ok(savedRows.every((row) => row.user_id === userId));

  const unauthorizedClient = {
    from: () => ({
      ...query,
      limit: () => Promise.resolve({ data: [{ ...remoteRow, user_id: "44444444-4444-4444-8444-444444444444" }], error: null }),
      upsert() { assert.fail("Must not save rows after an ownership mismatch."); }
    })
  };
  await assert.rejects(syncUserScenes(unauthorizedClient, userId, []), /unauthorized scene/);
});
