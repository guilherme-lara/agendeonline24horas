import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("AbacatePay webhook received:", JSON.stringify(body));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AbacatePay sends: { event: "billing.paid", data: { billing: { id, products: [{ externalId }], ... }, payment: { ... } } }
    const event = body.event;
    const billing = body.data?.billing || body.data || body;
    const billingId = billing.id;

    // Try to find appointment by payment_id (billing ID)
    let appointmentId: string | null = null;

    if (billingId) {
      const { data: appt } = await supabase
        .from("appointments")
        .select("id")
        .eq("payment_id", billingId)
        .maybeSingle();
      if (appt) appointmentId = appt.id;
    }

    // Fallback: find via externalId in products (which is the appointment_id)
    if (!appointmentId && billing.products?.length > 0) {
      const externalId = billing.products[0].externalId;
      if (externalId) {
        const { data: appt } = await supabase
          .from("appointments")
          .select("id")
          .eq("id", externalId)
          .maybeSingle();
        if (appt) appointmentId = appt.id;
      }
    }

    // Fallback: metadata
    if (!appointmentId && billing.metadata?.appointment_id) {
      appointmentId = billing.metadata.appointment_id;
    }
    if (!appointmentId && body.metadata?.appointment_id) {
      appointmentId = body.metadata.appointment_id;
    }

    if (!appointmentId) {
      console.log("No appointment found from webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map status
    const billingStatus = billing.status || "";
    const isPaid = event === "billing.paid" || billingStatus === "PAID" || billingStatus === "COMPLETED";

    let newPaymentStatus = "pending";
    let newAppointmentStatus = "pending";

    if (isPaid) {
      newPaymentStatus = "paid";
      newAppointmentStatus = "confirmed";
    } else if (billingStatus === "EXPIRED" || billingStatus === "CANCELLED") {
      newPaymentStatus = "failed";
    } else if (billingStatus === "PENDING") {
      newPaymentStatus = "awaiting";
    }

    await supabase
      .from("appointments")
      .update({
        payment_status: newPaymentStatus,
        status: newAppointmentStatus,
      })
      .eq("id", appointmentId);

    console.log(`Appointment ${appointmentId} updated: payment=${newPaymentStatus}, status=${newAppointmentStatus}`);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
