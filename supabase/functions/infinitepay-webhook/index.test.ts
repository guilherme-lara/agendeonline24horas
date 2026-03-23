import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;

Deno.test("Rejects invalid JSON", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: "not json",
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Invalid JSON");
});

Deno.test("Skips payload without payment_id", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ event: "test", status: "paid" }),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.skipped, true);
});

Deno.test("Handles unknown payment_id gracefully", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ payment_id: "fake-id-999", status: "paid" }),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.not_found, true);
});

Deno.test("Idempotent: 3 identical calls produce same result", async () => {
  const payload = { payment_id: "idempotent-test-abc", status: "paid" };
  for (let i = 0; i < 3; i++) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    assertEquals(res.status, 200);
    assert(body.ok === true);
  }
});
