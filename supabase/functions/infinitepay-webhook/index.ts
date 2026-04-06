import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * InfinitePay Webhook — Bulletproof + Partial Payment State Machine
 *
 * 1. Routes GET/OPTIONS gracefully (no 500)
 * 2. Rejects non-POST with 405
 * 3. Parses payload with try/catch
 * 4. Partial payment rule: if has_signal=true and amount >= signal_value,
 *    the appointment is confirmed (partial payment ok). If no signal,
 *    requires full price match. Records amount_paid for dashboard.
 */

Deno.serve(async (req) => {
  // --- 1. ROUTING ---
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ message: "InfinitePay Webhook Active. Use POST." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- 2. INIT ---
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // --- 3. PARSE SAFELY ---
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const appointmentId = payload.order_nsu as string | undefined;

  if (!appointmentId) {
    console.warn("Webhook: missing order_nsu. Payload keys:", Object.keys(payload).join(", "));
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "Missing order_nsu" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- 4. EXTRACT FIELDS ---
  const rawStatus = (payload.status ?? payload.payment_status ?? "") as string;
  const status = String(rawStatus).toLowerCase();

  const statusCode = payload.status_code as string | undefined;
  const isStatusApproved = [
    "paid", "approved", "completed", "confirmed", "authorized",
  ].includes(status);

  const isSuccessByCode = statusCode === "200" || statusCode === "10000";
  const isPayment = isStatusApproved || isSuccessByCode;

  // Amount from webhook (may come in cents or as float — normalize)
  const rawAmount = payload.amount ?? payload.paid_amount ?? payload.value ?? payload.total ?? null;
  const amountReceived = rawAmount != null
    ? normalizeAmount(Number(rawAmount))
    : null;

  console.log(`Webhook: appt=${appointmentId} status=${status} statusCode=${statusCode ?? "null"} amountReceived=${amountReceived ?? "null"}`);

  // --- 5. AUDIT LOG (best-effort) ---
  try {
    const { data: apptLookup } = await supabase
      .from("appointments")
      .select("barbershop_id")
      .eq("id", appointmentId)
      .maybeSingle();

    await supabase.from("payment_logs").insert({
      barbershop_id: apptLookup?.barbershop_id ?? null,
      source: "webhook_infinitepay",
      event_type: (payload.event_type as string) ?? "payment_notification",
      status_code: statusCode ?? null,
      request_body: payload,
      response_body: {},
      payment_id: (payload.payment_id as string) ?? (appointmentId ?? ""),
    });
  } catch (logErr) {
    console.error("Warning: payment_logs insert failed (non-critical):", logErr);
  }

  // --- 6. NOT A PAYMENT → skip ---
  if (!isPayment) {
    console.log(`Webhook: status [${status}] is not a payment. Skipping.`);
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: `Status [${status}] is not a recognized payment status.` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- 7. FETCH APPOINTMENT ---
  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, barbershop_id, status, price, total_price, signal_value, has_signal, payment_status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error || !appt) {
    console.error(`Webhook: appointment not found for id=${appointmentId}`);
    return new Response(
      JSON.stringify({ ok: false, error: "Appointment not found", appointment_id: appointmentId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- 8. IDEMPOTENCY ---
  if (appt.status === "confirmed" && appt.payment_status === "paid") {
    console.log(`Webhook: appointment ${appointmentId} already confirmed (idempotent).`);
    return new Response(
      JSON.stringify({ ok: true, already_processed: true, appointment_id: appointmentId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- 9. PARTIAL PAYMENT STATE MACHINE ---
  const totalPrice = Number(appt.total_price ?? appt.price ?? 0);
  const signalValue = Number(appt.signal_value ?? 0);
  const hasSignal = Boolean(appt.has_signal);
  const tolerance = 0.02; // R$ 0.01 tolerance for cent rounding

  if (amountReceived !== null && (hasSignal || totalPrice > 0)) {
    if (hasSignal && signalValue > 0) {
      // PARTIAL RULE: if amount >= signal_value, confirm the appointment
      if (amountReceived < signalValue - tolerance) {
        // Paid LESS than the signal — reject
        console.warn(
          `⚠️ Partial validation FAILED: appt=${appointmentId} received=${amountReceived} < signal=${signalValue}`
        );

        await supabase
          .from("appointments")
          .update({
            payment_status: "partial_insufficient",
            status: "pending",
          })
          .eq("id", appt.id);

        return new Response(
          JSON.stringify({
            ok: true,
            validation_failed: true,
            reason: `Amount ${amountReceived} < signal ${signalValue}`,
            required_min: signalValue,
            received: amountReceived,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // amount >= signal_value → confirm (partial payment valid)
      console.log(
        `✅ Partial payment OK: received=${amountReceived} >= signal=${signalValue}. Confirming appointment.`
      );
    } else {
      // NO SIGNAL: must match total price exactly
      const matchesTotal = Math.abs(amountReceived - totalPrice) <= tolerance;
      if (!matchesTotal) {
        console.warn(
          `🚨 Full price mismatch: appt=${appointmentId} expected=${totalPrice} received=${amountReceived}`
        );

        await supabase
          .from("appointments")
          .update({
            payment_status: "amount_mismatch",
            status: "flagged",
          })
          .eq("id", appt.id);

        return new Response(
          JSON.stringify({
            ok: true,
            validation_failed: true,
            reason: "Full price mismatch",
            expected: totalPrice,
            received: amountReceived,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ Full payment validated: received=${amountReceived} = total=${totalPrice}`);
    }
  } else if (amountReceived === null) {
    console.warn(
      `⚠️ Webhook: no amount in payload for appt=${appointmentId}. Confirming without validation.`
    );
  }

  // --- 10. SECURE UPDATE ---
  const paymentAmount = amountReceived !== null ? amountReceived : 0;

  let updateError: unknown = null;

  try {
    const rpcResult = await supabase.rpc("update_appointment_payment", {
      _appt_id: appt.id,
      _amount_paid: paymentAmount,
    });
    updateError = rpcResult.error;
  } catch (error) {
    updateError = error;
  }

  if (updateError) {
    // Fallback to direct update
    const fallbackUpdate = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        payment_status: "paid",
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", appt.id);

    if (fallbackUpdate.error) {
      console.error("Fallback update also failed:", fallbackUpdate.error);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to update appointment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const isPartial = hasSignal && signalValue > 0 && paymentAmount >= signalValue - tolerance && paymentAmount < totalPrice;

  console.log(`✅ Payment confirmed: appt=${appt.id} amount_paid=${paymentAmount} is_partial=${isPartial}`);

  return new Response(
    JSON.stringify({
      ok: true,
      payment_confirmed: true,
      appointment_id: appt.id,
      amount_paid: paymentAmount,
      is_partial: isPartial,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

/**
 * Normalize amount: InfinitePay sends cents (integer), convert to float.
 * Detects if the value looks like cents (> 100 suggests cents for typical payments).
 */
function normalizeAmount(value: number): number {
  if (value <= 0) return value;
  // If value is > 100 and is an integer, treat as cents
  if (value >= 100 && Number.isInteger(value)) {
    return value / 100;
  }
  return value;
}
