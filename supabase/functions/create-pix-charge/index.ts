import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("Payment endpoint is missing Supabase configuration");
    return respond({ error: "Serviço de pagamento indisponível." }, 500);
  }

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return respond({ error: "Payload inválido." }, 400);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return respond({ error: "JSON inválido." }, 400);
  }

  const barbershopId = typeof input.barbershop_id === "string" ? input.barbershop_id : "";
  const appointmentId = typeof input.appointment_id === "string" ? input.appointment_id : null;
  const amount = input.amount;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(barbershopId)) {
    return respond({ error: "Barbearia inválida." }, 400);
  }
  if (appointmentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return respond({ error: "Agendamento inválido." }, 400);
  }
  if (!Number.isSafeInteger(amount) || Number(amount) < 100) {
    return respond({ error: "O valor deve ser de no mínimo R$ 1,00." }, 400);
  }

  const userClient = createClient( supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond({ error: "Sessão inválida. Faça login novamente." }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: adminRole, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) {
    console.error("Unable to check payment caller role:", roleError.message);
    return respond({ error: "Não foi possível validar sua permissão." }, 500);
  }

  let isManager = !!adminRole;
  let callerBarber: { id: string; name: string | null } | null = null;
  let authorized = isManager;
  if (!authorized) {
    const { data: ownedShop, error: ownerError } = await adminClient
      .from("barbershops")
      .select("id")
      .eq("id", barbershopId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (ownerError) {
      console.error("Unable to check barbershop ownership:", ownerError.message);
      return respond({ error: "Não foi possível validar sua permissão." }, 500);
    }
    isManager = !!ownedShop;
    authorized = isManager;
  }
  if (!authorized) {
    const { data: barber, error: barberError } = await adminClient
      .from("barbers")
      .select("id, name")
      .eq("barbershop_id", barbershopId)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (barberError) {
      console.error("Unable to check barbershop staff membership:", barberError.message);
      return respond({ error: "Não foi possível validar sua permissão." }, 500);
    }
    callerBarber = barber;
    authorized = !!barber;
  }
  if (!authorized) return respond({ error: "Sem permissão para cobrar nesta barbearia." }, 403);

  const { data: shop, error: shopError } = await adminClient
    .from("barbershops")
    .select("settings, name")
    .eq("id", barbershopId)
    .maybeSingle();
  if (shopError) {
    console.error("Unable to load barbershop payment settings:", shopError.message);
    return respond({ error: "Não foi possível carregar os dados da barbearia." }, 500);
  }
  if (!shop) return respond({ error: "Barbearia não encontrada." }, 404);

  let appointment: Record<string, any> | null = null;
  let appointmentAmountPaid = 0;
  if (appointmentId) {
    const { data, error } = await adminClient
      .from("appointments")
      .select("id, barbershop_id, status, payment_status, payment_id, has_signal, signal_value, price, total_price, advance_payment_amount, amount_paid, service_name, client_name, barber_id, barber_name, expires_at")
      .eq("id", appointmentId)
      .eq("barbershop_id", barbershopId)
      .maybeSingle();
    if (error) {
      console.error("Unable to load appointment for payment:", error.message);
      return respond({ error: "Não foi possível validar o agendamento." }, 500);
    }
    if (!data) return respond({ error: "Agendamento não encontrado nesta barbearia." }, 404);
    appointment = data;

    if (callerBarber && appointment.barber_id !== callerBarber.id &&
      (appointment.barber_id || appointment.barber_name !== callerBarber.name)) {
      return respond({ error: "Você não tem permissão para cobrar este agendamento." }, 403);
    }
    if (appointment.status === "cancelled" ||
      (appointment.status === "completed" && appointment.payment_status === "paid")) {
      return respond({ error: "Este agendamento não aceita novos pagamentos." }, 409);
    }
    if (appointment.payment_status === "paid") {
      return respond({ error: "Este agendamento já está pago." }, 409);
    }
    if (appointment.payment_id) {
      return respond({ error: "Já existe uma cobrança em andamento para este agendamento." }, 409);
    }
    if (["pending_payment", "pendente_pagamento", "pending", "pendente_sinal"].includes(appointment.status) &&
      appointment.expires_at && new Date(appointment.expires_at).getTime() <= Date.now()) {
      return respond({ error: "A reserva expirou e não aceita novos pagamentos." }, 409);
    }
    const { data: payments, error: paymentsError } = await adminClient
      .from("appointment_payments")
      .select("amount")
      .eq("appointment_id", appointmentId)
      .eq("barbershop_id", barbershopId)
      .eq("status", "confirmed");
    if (paymentsError) {
      console.error("Unable to load confirmed appointment payments:", paymentsError.message);
      return respond({ error: "Não foi possível calcular o saldo do agendamento." }, 500);
    }

    const total = Number(appointment.total_price ?? appointment.price ?? 0);
    const paidFromPayments = (payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const amountPaid = Number(appointment.amount_paid || 0);
    const paidFromAppointment = Math.max(paidFromPayments, Number(appointment.advance_payment_amount || 0), amountPaid);
    const paid = appointment.payment_status === "paid" && paidFromAppointment === 0
      ? total
      : paidFromAppointment;
    appointmentAmountPaid = paid;
    const remaining = Math.max(0, Math.round((total - paid) * 100));
    if (!Number.isFinite(total) || total <= 0 || Number(amount) > remaining) {
      return respond({ error: "O valor da cobrança excede o saldo do agendamento." }, 422);
    }
    const signalRemaining = Math.max(
      0,
      Math.round((Number(appointment.signal_value || 0) - paid) * 100),
    );
    if (appointment.has_signal && signalRemaining > 0 && Number(amount) < signalRemaining) {
      return respond({ error: "O valor da cobrança não cobre o sinal restante." }, 422);
    }
    if (!appointment.has_signal && Number(amount) !== remaining) {
      return respond({ error: "Sem sinal configurado, a cobrança deve quitar o saldo total." }, 422);
    }
  }

  const { data: secrets, error: secretsError } = await adminClient
    .from("barbershop_secrets")
    .select("infinitepay_token")
    .eq("barbershop_id", barbershopId)
    .maybeSingle();
  if (secretsError) {
    console.error("Unable to load InfinitePay credentials:", secretsError.message);
    return respond({ error: "Não foi possível carregar as credenciais de pagamento." }, 500);
  }

  const settings = (shop.settings || {}) as Record<string, unknown>;
  const pixKey = typeof settings.pix_key === "string" ? settings.pix_key : "";
  const beneficiary = typeof settings.pix_beneficiary === "string" ? settings.pix_beneficiary : shop.name;
  const token = secrets?.infinitepay_token || "";

  if (!token) {
    if (appointment) {
      const { error } = await adminClient
        .from("appointments")
        .update({
          payment_status: appointmentAmountPaid > 0 ? "partial" : "awaiting",
          payment_method: "pix_static",
        })
        .eq("id", appointment.id)
        .eq("barbershop_id", barbershopId);
      if (error) {
        console.error("Unable to mark appointment as awaiting static Pix:", error.message);
        return respond({ error: "Não foi possível atualizar o pagamento do agendamento." }, 500);
      }
    }
    return respond({
      success: true,
      mode: "static",
      pix_key: pixKey,
      pix_beneficiary: beneficiary,
      brcode: "",
      qr_code_base64: "",
      payment_id: "",
    });
  }

  const documentNumber = typeof input.document_number === "string"
    ? input.document_number.replace(/[^0-9]/g, "")
    : "";
  const firstName = typeof input.first_name === "string"
    ? input.first_name.trim().slice(0, 80)
    : appointment?.client_name?.split(" ")[0] || "Cliente";
  const lastName = typeof input.last_name === "string"
    ? input.last_name.trim().slice(0, 80)
    : appointment?.client_name?.split(" ").slice(1).join(" ") || "N";
  const description = `${String(appointment?.service_name || "Venda PDV")} - ${shop.name}`
    .replace(/[^\w\sÀ-ú-]/g, "")
    .slice(0, 120);

  const chargeRequestId = `charge-pending:${crypto.randomUUID()}`;
  if (appointment) {
    const { data: reservation, error: reservationError } = await adminClient
      .from("appointments")
      .update({
        payment_id: chargeRequestId,
        payment_expected_amount: Number(amount) / 100,
        payment_status: appointmentAmountPaid > 0 ? "partial" : "awaiting",
        payment_method: "pix_infinitepay",
        pix_code: null,
      })
      .eq("id", appointment.id)
      .eq("barbershop_id", barbershopId)
      .is("payment_id", null)
      .select("id")
      .maybeSingle();
    if (reservationError) {
      console.error("Unable to reserve appointment Pix charge:", reservationError.message);
      return respond({ error: "Não foi possível reservar a cobrança." }, 500);
    }
    if (!reservation) {
      return respond({ error: "Já existe uma cobrança em andamento para este agendamento." }, 409);
    }
  }

  const releaseChargeReservation = async () => {
    if (!appointment) return;
    const { error } = await adminClient
      .from("appointments")
      .update({
        payment_id: null,
        payment_expected_amount: null,
        payment_status: appointmentAmountPaid > 0 ? "partial" : "pending",
        payment_method: null,
      })
      .eq("id", appointment.id)
      .eq("barbershop_id", barbershopId)
      .eq("payment_id", chargeRequestId);
    if (error) {
      console.error("Unable to release failed Pix charge reservation:", error.message);
    }
  };

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.infinitepay.io/v2/pix/qrcode", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(amount),
        document_number: documentNumber,
        first_name: firstName || "Cliente",
        last_name: lastName || "N",
        description,
      }),
    });
  } catch (error) {
    await releaseChargeReservation();
    console.error("InfinitePay request failed:", error instanceof Error ? error.message : "unknown error");
    return respond({ error: "Não foi possível conectar ao serviço de pagamento." }, 502);
  }

  let providerData: Record<string, unknown>;
  try {
    providerData = await providerResponse.json();
  } catch {
    await releaseChargeReservation();
    console.error("InfinitePay returned a non-JSON response:", providerResponse.status);
    return respond({ error: "Resposta inválida do serviço de pagamento." }, 502);
  }
  if (!providerResponse.ok) {
    await releaseChargeReservation();
    console.error("InfinitePay rejected Pix charge:", providerResponse.status);
    return respond({ error: "Não foi possível gerar a cobrança Pix." }, 502);
  }

  const brcode = String(providerData.brcode || providerData.pix_code || "");
  const qrCode = String(providerData.qr_code_base64 || providerData.qr_code || "");
  const paymentId = String(providerData.id || providerData.payment_id || "");

  if (appointment) {
    const { error } = await adminClient
      .from("appointments")
      .update({
        payment_id: paymentId || chargeRequestId,
        payment_method: "pix_infinitepay",
        pix_code: brcode || null,
      })
      .eq("id", appointment.id)
      .eq("barbershop_id", barbershopId)
      .eq("payment_id", chargeRequestId);
    if (error) {
      console.error("Unable to save appointment Pix details:", error.message);
      return respond({ error: "A cobrança foi criada, mas não foi possível atualizar o agendamento. Contate o suporte." }, 500);
    }
  }

  return respond({
    success: true,
    mode: "infinitepay",
    brcode,
    qr_code_base64: qrCode,
    payment_id: paymentId,
  });
});
