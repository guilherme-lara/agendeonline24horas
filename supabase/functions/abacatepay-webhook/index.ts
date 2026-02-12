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

    // AbacatePay sends billing data with status
    const billing = body.data || body;
    const billingId = billing.id || billing.billing_id;
    const status = billing.status;

    if (!billingId) {
      console.log("No billing ID found in webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find appointment by payment_id
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("payment_id", billingId)
      .maybeSingle();

    if (!appt) {
      console.log(`No appointment found for payment_id: ${billingId}`);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map AbacatePay status to our status
    let newPaymentStatus = "pending";
    let newAppointmentStatus = appt.status;

    if (status === "PAID" || status === "COMPLETED") {
      newPaymentStatus = "paid";
      newAppointmentStatus = "confirmed";
    } else if (status === "EXPIRED" || status === "CANCELLED") {
      newPaymentStatus = "failed";
    } else if (status === "PENDING") {
      newPaymentStatus = "awaiting";
    }

    await supabase
      .from("appointments")
      .update({
        payment_status: newPaymentStatus,
        status: newAppointmentStatus,
      })
      .eq("id", appt.id);

    console.log(`Appointment ${appt.id} updated: payment=${newPaymentStatus}, status=${newAppointmentStatus}`);

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
