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

    // 🔒 GRAVAR LOG BRUTO ANTES DE PROCESSAR (auditoria obrigatória)
    const paymentId = payload.id || payload.payment_id || payload.transaction_id || "";
    const eventType = payload.event || payload.type || payload.status || "unknown";

    await supabase.from("webhook_logs").insert({
      event_type: eventType,
      payment_id: paymentId,
      raw_payload: payload,
      processed: false,
    });

    // 🔒 VALIDAÇÃO DE ASSINATURA (quando configurada)
    const signature = req.headers.get("x-webhook-signature") || req.headers.get("x-infinitepay-signature") || "";
    
    // Buscar o appointment pelo payment_id para encontrar o barbershop_id
    if (!paymentId) {
      console.warn("Webhook sem payment_id, ignorando");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // 🔒 IDEMPOTÊNCIA: Se já está pago, não processa novamente
    if (appt.payment_status === "paid") {
      console.log("Payment already processed (idempotent skip):", paymentId);
      // Atualiza o log como já processado
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

    // 🔒 VALIDAÇÃO DE ASSINATURA (opcional, se configurada por barbershop)
    if (signature && appt.barbershop_id) {
      const { data: secrets } = await supabase
        .from("barbershop_secrets")
        .select("webhook_secret")
        .eq("barbershop_id", appt.barbershop_id)
        .maybeSingle();

      if (secrets?.webhook_secret) {
        // Validação HMAC básica
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(secrets.webhook_secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
        const expectedSig = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (signature !== expectedSig) {
          console.error("Webhook signature mismatch! Possible forgery.");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Verifica status do pagamento
    const status = payload.status || payload.payment_status || "";
    const isPaid = ["paid", "approved", "completed", "confirmed"].includes(status.toLowerCase());

    if (isPaid) {
      // Atualiza o agendamento como pago
      // Registra payment_confirmed_at em horário de Brasília (UTC-3)
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
    }

    // Marca o log como processado
    await supabase
      .from("webhook_logs")
      .update({ processed: true, barbershop_id: appt.barbershop_id })
      .eq("payment_id", paymentId)
      .eq("processed", false);

    return new Response(
      JSON.stringify({ ok: true, payment_confirmed: isPaid }),
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
