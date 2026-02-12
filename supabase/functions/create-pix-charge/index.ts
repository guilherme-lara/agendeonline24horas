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
    const { appointment_id, barbershop_id } = await req.json();

    if (!appointment_id || !barbershop_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id and barbershop_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get barbershop settings (API key)
    const { data: shop, error: shopErr } = await supabase
      .from("barbershops")
      .select("settings, name")
      .eq("id", barbershop_id)
      .single();

    if (shopErr || !shop) {
      return new Response(
        JSON.stringify({ error: "Barbearia não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const abacatePayKey = (shop.settings as Record<string, any>)?.abacate_pay_api_key;
    if (!abacatePayKey) {
      return new Response(
        JSON.stringify({ error: "Chave AbacatePay não configurada para esta barbearia", no_key: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get appointment
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .single();

    if (apptErr || !appt) {
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Webhook URL for AbacatePay callbacks
    const webhookUrl = `${supabaseUrl}/functions/v1/abacatepay-webhook`;

    // Create billing on AbacatePay
    const abacateRes = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${abacatePayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        frequency: "ONE_TIME",
        methods: ["PIX"],
        products: [
          {
            externalId: appointment_id,
            name: `${appt.service_name} - ${shop.name}`,
            quantity: 1,
            price: Math.round(Number(appt.price) * 100), // cents
          },
        ],
        metadata: {
          appointment_id: appointment_id,
          barbershop_id: barbershop_id,
        },
        returnUrl: webhookUrl,
        completionUrl: `${req.headers.get("origin") || "https://agendeonline24horas.lovable.app"}/agendamentos/sucesso`,
      }),
    });

    const abacateData = await abacateRes.json();

    if (!abacateRes.ok) {
      console.error("AbacatePay error:", abacateData);
      return new Response(
        JSON.stringify({ error: "Erro ao criar cobrança no AbacatePay", details: abacateData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract payment info
    const paymentUrl = abacateData.data?.url || abacateData.url || "";
    const paymentId = abacateData.data?.id || abacateData.id || "";
    const pixCode = abacateData.data?.pixQrCode || abacateData.data?.pix_qr_code || abacateData.data?.brcode || "";
    const pixQrCodeImage = abacateData.data?.pixQrCodeBase64 || abacateData.data?.qr_code_base64 || "";

    await supabase
      .from("appointments")
      .update({
        payment_id: paymentId,
        payment_url: paymentUrl,
        payment_status: "awaiting",
      })
      .eq("id", appointment_id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        payment_id: paymentId,
        pix_code: pixCode,
        pix_qr_code_image: pixQrCodeImage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in create-pix-charge:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
