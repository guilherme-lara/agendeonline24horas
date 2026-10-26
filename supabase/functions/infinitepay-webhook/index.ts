import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeProviderAmount,
  validatePaymentAmount,
} from "../_shared/payment-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-infinitepay-webhook-secret",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const constantTimeEqual = (actual: string, expected: string) => {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  let difference = 0;
  for (let i = 0; i < actualBytes.length; i++) difference |= actualBytes[i] ^ expectedBytes[i];
  return difference === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return respond({ message: "InfinitePay webhook active." });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("INFINITEPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("INFINITEPAY_WEBHOOK_SECRET is not configured; rejecting webhook");
    return respond({ error: "Webhook de pagamento não configurado." }, 503);
  }
  const providedSecret = req.headers.get("x-infinitepay-webhook-secret") || "";
  if (!constantTimeEqual(providedSecret, webhookSecret)) {
    return respond({ error: "Webhook não autenticado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Payment webhook is missing Supabase configuration");
    return respond({ error: "Serviço de pagamento indisponível." }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return respond({ error: "Payload inválido." }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return respond({ error: "JSON inválido." }, 400);
  }

  const appointmentId = typeof payload.order_nsu === "string" ? payload.order_nsu : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return respond({ error: "Identificador de agendamento inválido." }, 400);
  }

  const status = String(payload.status ?? payload.payment_status ?? "").toLowerCase();
  const statusCode = String(payload.status_code ?? "");
  const isPayment = ["paid", "approved", "completed", "confirmed"].includes(status);
  if (!isPayment) return respond({ ok: true, skipped: true });

  const rawAmount = payload.amount ?? payload.paid_amount ?? payload.value ?? payload.total;
  const numericAmount = typeof rawAmount === "number" || typeof rawAmount === "string"
    ? Number(rawAmount)
    : Number.NaN;
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    console.warn(`Authenticated payment webhook had no valid amount for appointment ${appointmentId}`);
    return respond({ error: "O pagamento não contém um valor válido." }, 422);
  }
  const amountReceived = normalizeProviderAmount(numericAmount);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: appt, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, barbershop_id, status, price, total_price, signal_value, has_signal, payment_status, amount_paid, advance_payment_amount, payment_expected_amount")
    .eq("id", appointmentId)
    .maybeSingle();
  if (appointmentError) {
    console.error("Unable to load webhook appointment:", appointmentError.message);
    return respond({ error: "Não foi possível validar o agendamento." }, 500);
  }
  if (!appt) return respond({ error: "Agendamento não encontrado." }, 404);

  const safeLogBody = {
    order_nsu: appointmentId,
    status,
    status_code: statusCode,
    amount: numericAmount,
  };
  const { error: logError } = await supabase.from("payment_logs").insert({
    barbershop_id: appt.barbershop_id,
    source: "webhook_infinitepay",
    event_type: typeof payload.event_type === "string" ? payload.event_type : "payment_notification",
    status_code: statusCode || null,
    request_body: safeLogBody,
    response_body: {},
    payment_id: typeof payload.payment_id === "string" ? payload.payment_id : appointmentId,
  });
  if (logError) console.warn("Payment webhook audit log could not be saved:", logError.message);

  if (appt.payment_status === "paid") {
    return respond({ ok: true, already_processed: true, appointment_id: appt.id });
  }

  const paymentReference = [payload.payment_id, payload.transaction_nsu]
    .find((value): value is string | number =>
      (typeof value === "string" && value.trim().length > 0) ||
      (typeof value === "number" && Number.isSafeInteger(value))
    );
  if (paymentReference === undefined) {
    console.warn(`Authenticated payment webhook has no unique payment reference for appointment ${appt.id}`);
    return respond({ error: "O evento não contém um identificador único de pagamento." }, 422);
  }
  const externalReference = `infinitepay:${paymentReference}`;
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("appointment_payments")
    .select("id")
    .eq("appointment_id", appt.id)
    .eq("barbershop_id", appt.barbershop_id)
    .eq("external_reference", externalReference)
    .maybeSingle();
  if (existingPaymentError) {
    console.error("Unable to check for duplicate InfinitePay payment:", existingPaymentError.message);
    return respond({ error: "Não foi possível validar o pagamento." }, 500);
  }
  if (existingPayment) {
    return respond({ ok: true, already_processed: true, appointment_id: appt.id });
  }

  const { data: confirmedPayments, error: confirmedPaymentsError } = await supabase
    .from("appointment_payments")
    .select("amount")
    .eq("appointment_id", appt.id)
    .eq("barbershop_id", appt.barbershop_id)
    .eq("status", "confirmed");
  if (confirmedPaymentsError) {
    console.error("Unable to load confirmed appointment payments:", confirmedPaymentsError.message);
    return respond({ error: "Não foi possível calcular o saldo do agendamento." }, 500);
  }
  const amountPaid = Math.max(
    Number(appt.amount_paid || 0),
    Number(appt.advance_payment_amount || 0),
    (confirmedPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
  );

  const totalPrice = Number(appt.total_price ?? appt.price ?? 0);
  const expectedAmount = appt.payment_expected_amount == null
    ? null
    : Number(appt.payment_expected_amount);
  const paymentValidation = validatePaymentAmount({
    amountReceived,
    amountPaid,
    totalAmount: totalPrice,
    expectedAmount,
    hasSignal: Boolean(appt.has_signal),
    signalAmount: Number(appt.signal_value || 0),
  });
  if (!paymentValidation.valid) {
    console.warn(`Payment amount validation failed for appointment ${appt.id}: ${paymentValidation.reason}`);
    return respond({
      ok: true,
      validation_failed: true,
      reason: paymentValidation.reason,
      expected: expectedAmount,
      received: amountReceived,
      remaining: Math.max(0, totalPrice - amountPaid),
    });
  }

  const { error: updateError } = await supabase.rpc("confirm_infinitepay_payment", {
    _appointment_id: appt.id,
    _amount_paid: amountReceived,
    _payment_reference: externalReference,
    _expected_amount: expectedAmount,
  });
  if (updateError) {
    console.error("Unable to confirm InfinitePay payment:", updateError.message);
    return respond({ error: "Não foi possível confirmar o pagamento." }, 500);
  }

  return respond({
    ok: true,
    payment_confirmed: true,
    appointment_id: appt.id,
    amount_paid: amountReceived,
    is_partial: !paymentValidation.fullyPaid,
  });
});
