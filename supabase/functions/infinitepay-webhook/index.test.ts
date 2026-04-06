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
  assert(res.status >= 400);
  assertEquals(typeof body.error, "string");
});

Deno.test("Skips payload without order_nsu", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ event: "test", status: "paid" }),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.skipped, true);
  assertEquals(body.reason, "Missing order_nsu");
});

Deno.test("Handles unknown order_nsu gracefully", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ order_nsu: "fake-id-999", status: "paid" }),
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, false);
  assertEquals(body.error, "Appointment not found");
  assertEquals(body.appointment_id, "fake-id-999");
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
