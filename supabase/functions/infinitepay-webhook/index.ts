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
    const appointmentId = payload.order_nsu;

    if (!appointmentId) {
      console.warn("Webhook recebido sem o campo 'order_nsu'. Ignorando.");
      return new Response(JSON.stringify({ ok: true, skipped: "Missing order_nsu" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log every webhook event for audit trail
    try {
      const { data: apptLookup } = await supabase
        .from("appointments")
        .select("barbershop_id")
        .eq("id", appointmentId)
        .maybeSingle();

      await supabase
        .from("payment_logs")
        .insert({
          barbershop_id: apptLookup?.barbershop_id || null,
          source: "webhook_infinitepay",
          event_type: payload.event_type || "payment_notification",
          status_code: payload.status_code || null,
          request_body: payload,
          response_body: {},
          payment_id: payload.payment_id || payload.order_nsu || "",
        });
    } catch (logErr) {
      console.error("Falha ao logar payment_logs (ignora e continua):", logErr);
    }

    const status = payload.status || payload.payment_status || "";
    const isPaid = ["paid", "approved", "completed", "confirmed"].includes(status.toLowerCase());

    if (!isPaid) {
      return new Response(
        JSON.stringify({ ok: true, payment_confirmed: false, reason: `Status [${status}] não é um pagamento válido.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id, barbershop_id, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (error || !appt) {
      console.error("Agendamento não encontrado para o ID fornecido no order_nsu:", appointmentId, error);
      return new Response(JSON.stringify({ ok: false, error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (appt.status === "confirmed") {
      console.log("Agendamento já confirmado (idempotência):", appointmentId);
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        payment_status: "paid",
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", appt.id);

    if (updateError) {
      console.error("Falha ao atualizar agendamento para confirmado:", updateError);
      return new Response(JSON.stringify({ ok: false, error: "Failed to update appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Pagamento confirmado e agendamento atualizado para 'confirmed'. ID:", appt.id);

    return new Response(
      JSON.stringify({ ok: true, payment_confirmed: true, appointment_id: appt.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Erro geral no processamento do webhook da InfinitePay:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
