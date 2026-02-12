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

    // Auto-cancel expired Pix appointments
    try {
      await supabase.rpc("cancel_expired_pix_appointments");
    } catch (e) {
      console.log("Auto-cancel check (non-blocking):", e);
    }

    const event = body.event || "";
    const data = body.data || {};

    // AbacatePay DevMode nests data differently:
    // - data.pixQrCode contains metadata and payment info
    // - data.billing may or may not exist
    const billing = data.billing || data || {};
    const pixQrCode = data.pixQrCode || {};
    const billingId = billing.id || "";
    const billingStatus = billing.status || pixQrCode.status || "";

    console.log(`Event: ${event}, Billing ID: ${billingId}, Status: ${billingStatus}`);

    // === Find appointment_id using multiple strategies ===
    let appointmentId: string | null = null;

    // Strategy 1: Find by payment_id stored in appointments
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

    // Strategy 2: externalId in products
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

    // Strategy 3: metadata — check ALL possible locations
    if (!appointmentId) {
      const metaId =
        billing.metadata?.appointment_id ||
        pixQrCode.metadata?.appointment_id ||
        data.metadata?.appointment_id ||
        body.metadata?.appointment_id;
      if (metaId) {
        // Verify the appointment exists
        const { data: appt } = await supabase
          .from("appointments")
          .select("id")
          .eq("id", metaId)
          .maybeSingle();
        if (appt) {
          appointmentId = appt.id;
          console.log(`Found appointment by metadata: ${appointmentId}`);
        } else {
          console.log(`Metadata appointment_id ${metaId} not found in DB`);
        }
      }
    }

    if (!appointmentId) {
      console.log("No appointment found from webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine payment status from event and status fields
    const isPaid =
      event === "billing.paid" ||
      event === "PAYMENT.RECEIVED" ||
      billingStatus === "PAID" ||
      billingStatus === "COMPLETED" ||
      billingStatus === "APPROVED";

    let updateData: Record<string, unknown> = {};

    if (isPaid) {
      updateData = {
        payment_status: "paid",
        status: "confirmed",
        payment_confirmed_at: new Date().toISOString(),
      };
    } else if (
      billingStatus === "EXPIRED" ||
      billingStatus === "CANCELLED" ||
      event === "billing.expired"
    ) {
      updateData = {
        payment_status: "failed",
        status: "cancelled",
      };
    } else if (billingStatus === "PENDING" || billingStatus === "WAITING") {
      updateData = {
        payment_status: "awaiting",
      };
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (updateErr) {
        console.error(`Failed to update appointment ${appointmentId}:`, updateErr);
      } else {
        console.log(`Appointment ${appointmentId} updated:`, JSON.stringify(updateData));
      }
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
