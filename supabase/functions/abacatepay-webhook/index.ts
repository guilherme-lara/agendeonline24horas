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

    // AbacatePay webhook formats:
    // Format 1: { event: "billing.paid", data: { billing: { id, products: [...], status }, payment: {...} } }
    // Format 2: { event: "billing.paid", data: { id, products: [...], status } }
    // Format 3: Direct billing object
    const event = body.event || "";
    const billing = body.data?.billing || body.data || body;
    const billingId = billing.id || "";
    const billingStatus = billing.status || "";

    console.log(`Event: ${event}, Billing ID: ${billingId}, Status: ${billingStatus}`);

    // Strategy 1: Find appointment by payment_id (billing ID stored during charge creation)
    let appointmentId: string | null = null;

    if (billingId) {
      const { data: appt } = await supabase
        .from("appointments")
        .select("id")
        .eq("payment_id", billingId)
        .maybeSingle();
      if (appt) {
        appointmentId = appt.id;
        console.log(`Found appointment by payment_id: ${appointmentId}`);
      }
    }

    // Strategy 2: Find via externalId in products (which is the appointment_id we set)
    if (!appointmentId && billing.products?.length > 0) {
      const externalId = billing.products[0].externalId;
      if (externalId) {
        const { data: appt } = await supabase
          .from("appointments")
          .select("id")
          .eq("id", externalId)
          .maybeSingle();
        if (appt) {
          appointmentId = appt.id;
          console.log(`Found appointment by externalId: ${appointmentId}`);
        }
      }
    }

    // Strategy 3: metadata
    if (!appointmentId) {
      const metaId = billing.metadata?.appointment_id || body.metadata?.appointment_id || body.data?.metadata?.appointment_id;
      if (metaId) {
        appointmentId = metaId;
        console.log(`Found appointment by metadata: ${appointmentId}`);
      }
    }

    if (!appointmentId) {
      console.log("No appointment found from webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine new status based on event and billing status
    const isPaid =
      event === "billing.paid" ||
      event === "PAYMENT.RECEIVED" ||
      billingStatus === "PAID" ||
      billingStatus === "COMPLETED" ||
      billingStatus === "APPROVED";

    let newPaymentStatus = "pending";
    let newAppointmentStatus = "pending";

    if (isPaid) {
      newPaymentStatus = "paid";
      newAppointmentStatus = "confirmed";
    } else if (billingStatus === "EXPIRED" || billingStatus === "CANCELLED" || event === "billing.expired") {
      newPaymentStatus = "failed";
      newAppointmentStatus = "pending";
    } else if (billingStatus === "PENDING" || billingStatus === "WAITING") {
      newPaymentStatus = "awaiting";
      newAppointmentStatus = "pending";
    }

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({
        payment_status: newPaymentStatus,
        status: newAppointmentStatus,
      })
      .eq("id", appointmentId);

    if (updateErr) {
      console.error(`Failed to update appointment ${appointmentId}:`, updateErr);
    } else {
      console.log(`Appointment ${appointmentId} updated: payment=${newPaymentStatus}, status=${newAppointmentStatus}`);
    }

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
