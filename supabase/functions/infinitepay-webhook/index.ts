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
    const payload = await req.json();

<<<<<<< HEAD
    const appointmentId = payload.order_nsu;
    if (!appointmentId) {
      console.warn("Webhook recebido sem 'order_nsu'. Ignorando.");
      return new Response(JSON.stringify({ ok: true, skipped: "Missing order_nsu" }), {
=======
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PING test — returns immediately
    if (payload.ping === true) {
      return new Response(JSON.stringify({ ok: true, message: "Webhook endpoint is active" }), {
        status: 200,
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

    // Log detalhado na tabela payment_logs para debug
    await supabase.from("payment_logs").insert({
      source: "infinitepay-webhook",
      event_type: eventType,
      status_code: 200,
      request_body: payload,
      payment_id: paymentId,
    });

    if (!paymentId) {
      console.warn("Webhook sem payment_id, ignorando");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
>>>>>>> origin/main
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const status = payload.status || payload.payment_status || "";
    const isPaid = ["paid", "approved", "completed", "confirmed"].includes(status.toLowerCase());

    if (!isPaid) {
      return new Response(
        JSON.stringify({ ok: true, payment_confirmed: false, reason: `Status [${status}] não é um pagamento válido.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ROTA DE PAGAMENTO DE AGENDAMENTO (PIVOTAGEM) ===
    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id, barbershop_id, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (error || !appt) {
      console.error("Agendamento não encontrado para o ID:", appointmentId, error);
      return new Response(JSON.stringify({ ok: false, error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTÊNCIA: Não processar se já estiver confirmado
    if (appt.status === "confirmed") {
      console.log("Agendamento já confirmado (idemponência):", appointmentId);
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualiza o agendamento para "confirmed"
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        payment_status: "paid",
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", appt.id);

    if (updateError) {
      console.error("Falha ao atualizar agendamento:", updateError);
      return new Response(JSON.stringify({ ok: false, error: "Failed to update appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Pagamento confirmado e agendamento atualizado com sucesso para:", appt.id);

    return new Response(
      JSON.stringify({ ok: true, payment_confirmed: true, appointment_id: appt.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Erro geral no webhook:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
