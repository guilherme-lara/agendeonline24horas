import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
const anonKey = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook`;

Deno.test("Rejects webhook events without the configured secret header", async () => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({
      order_nsu: "550e8400-e29b-41d4-a716-446655440000",
      status: "paid",
      amount: 10000,
    }),
  });
  const body = await response.json();

  assert([401, 503].includes(response.status));
  assertEquals(typeof body.error, "string");
  assert(body.payment_confirmed !== true);
});
