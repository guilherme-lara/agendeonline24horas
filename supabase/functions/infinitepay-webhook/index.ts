import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 LOG BRUTO ANTES DE PROCESSAR
    const paymentId = payload.id || payload.payment_id || payload.transaction_id || "";
    const eventType = payload.event || payload.type || payload.status || "unknown";

    await supabase.from("webhook_logs").insert({
      event_type: eventType,
      payment_id: paymentId,
      raw_payload: payload,
      processed: false,
    });

    if (!paymentId) {
      console.warn("Webhook sem payment_id, ignorando");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica status do pagamento
    const status = payload.status || payload.payment_status || "";
    const isPaid = ["paid", "approved", "completed", "confirmed"].includes(status.toLowerCase());

    if (!isPaid) {
      return new Response(
        JSON.stringify({ ok: true, payment_confirmed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ROTA 1: Pagamento de PLANO SaaS ===
    // Detecta via metadata.ref (barbershop_id) e valores de plano
    const refBarbershopId = payload.metadata?.ref || payload.ref || 
      new URL(payload.checkout_url || "https://x.com").searchParams.get("ref") || "";
    const amount = Number(payload.amount || payload.value || 0);
    
    // Valores dos planos (em centavos ou reais)
    const planPrices: Record<string, string> = {
      "49.9": "bronze", "49.90": "bronze", "4990": "bronze",
      "79.9": "prata", "79.90": "prata", "7990": "prata",
      "99.9": "ouro", "99.90": "ouro", "9990": "ouro",
    };

    const detectedPlan = planPrices[String(amount)] || planPrices[String(amount / 100)] || "";

    if (refBarbershopId && detectedPlan) {
      console.log(`Plan payment detected: ${detectedPlan} for barbershop ${refBarbershopId}`);
      
      // Check idempotency - don't create duplicate plan entries
      const { data: existingPlan } = await supabase
        .from("saas_plans")
        .select("id")
        .eq("barbershop_id", refBarbershopId)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!existingPlan) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Deactivate any existing plans
        await supabase
          .from("saas_plans")
          .update({ status: "expired" })
          .eq("barbershop_id", refBarbershopId)
          .eq("status", "active");

        // Create new active plan
        await supabase.from("saas_plans").insert({
          barbershop_id: refBarbershopId,
          plan_name: detectedPlan,
          status: "active",
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
          price: amount > 100 ? amount / 100 : amount,
        });

        console.log(`Plan ${detectedPlan} activated until ${expiresAt}`);
      } else {
        console.log("Active plan already exists, idempotent skip");
      }

      await supabase
        .from("webhook_logs")
        .update({ processed: true, barbershop_id: refBarbershopId })
        .eq("payment_id", paymentId)
        .eq("processed", false);

      return new Response(
        JSON.stringify({ ok: true, plan_activated: detectedPlan }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ROTA 2: Pagamento de AGENDAMENTO ===
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, barbershop_id, payment_status, payment_id")
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (!appt) {
      console.warn("Appointment not found for payment_id:", paymentId);
      return new Response(JSON.stringify({ ok: true, not_found: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 IDEMPOTÊNCIA
    if (appt.payment_status === "paid") {
      console.log("Payment already processed (idempotent skip):", paymentId);
      await supabase
        .from("webhook_logs")
        .update({ processed: true, barbershop_id: appt.barbershop_id })
        .eq("payment_id", paymentId)
        .eq("processed", false);

      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 VALIDAÇÃO DE ASSINATURA
    const signature = req.headers.get("x-webhook-signature") || req.headers.get("x-infinitepay-signature") || "";
    if (signature && appt.barbershop_id) {
      const { data: secrets } = await supabase
        .from("barbershop_secrets")
        .select("webhook_secret")
        .eq("barbershop_id", appt.barbershop_id)
        .maybeSingle();

      if (secrets?.webhook_secret) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw", encoder.encode(secrets.webhook_secret),
          { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
        const expectedSig = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0")).join("");

        if (signature !== expectedSig) {
          console.error("Webhook signature mismatch!");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Atualiza agendamento como pago
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await supabase
      .from("appointments")
      .update({
        payment_status: "paid",
        payment_confirmed_at: nowBRT.toISOString(),
        status: "confirmed",
      })
      .eq("id", appt.id);

    console.log("Payment confirmed for appointment:", appt.id);

    await supabase
      .from("webhook_logs")
      .update({ processed: true, barbershop_id: appt.barbershop_id })
      .eq("payment_id", paymentId)
      .eq("processed", false);

    return new Response(
      JSON.stringify({ ok: true, payment_confirmed: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
