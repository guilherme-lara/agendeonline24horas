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
      .select("settings, name, slug")
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

    const priceInCents = Math.round(Number(appt.price) * 100);

    // Build the completion URL using the barbershop slug
    const origin = req.headers.get("origin") || "https://agendeonline24horas.lovable.app";
    const webhookUrl = `${supabaseUrl}/functions/v1/abacatepay-webhook`;
    const completionUrl = `${origin}/agendamentos/${shop.slug}?success=true`;
    const returnUrl = webhookUrl;

    // Step 1: Create billing on AbacatePay
    console.log("Creating billing on AbacatePay...");
    const billingRes = await fetch("https://api.abacatepay.com/v1/billing/create", {
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
            price: priceInCents,
          },
        ],
        metadata: {
          appointment_id: appointment_id,
          barbershop_id: barbershop_id,
        },
        returnUrl: returnUrl,
        completionUrl: completionUrl,
      }),
    });

    const billingData = await billingRes.json();
    console.log("AbacatePay billing response:", JSON.stringify(billingData));

    if (!billingRes.ok) {
      console.error("AbacatePay billing error:", billingData);
      return new Response(
        JSON.stringify({ error: "Erro ao criar cobrança no AbacatePay", details: billingData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract payment URL from billing response: data.url
    const paymentUrl = billingData?.data?.url || "";
    const paymentId = billingData?.data?.id || "";

    // Step 2: Create a Pix QR Code to get brCode and brCodeBase64
    let brCode = "";
    let brCodeBase64 = "";

    console.log("Creating Pix QR Code...");
    try {
      const pixRes = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${abacatePayKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: priceInCents,
          description: `${appt.service_name} - ${shop.name}`,
          expiresIn: 3600,
          metadata: {
            appointment_id: appointment_id,
            barbershop_id: barbershop_id,
          },
        }),
      });

      const pixData = await pixRes.json();
      console.log("AbacatePay pixQrCode response:", JSON.stringify(pixData));

      if (pixRes.ok && pixData?.data) {
        brCode = pixData.data.brCode || pixData.data.brcode || "";
        brCodeBase64 = pixData.data.brCodeBase64 || pixData.data.brcode_base64 || "";
      }
    } catch (pixErr) {
      console.error("Pix QR Code creation failed (non-blocking):", pixErr);
      // Non-blocking: we still have the billing URL as fallback
    }

    // Persist payment data in the appointment
    await supabase
      .from("appointments")
      .update({
        payment_id: paymentId,
        payment_url: paymentUrl,
        payment_status: "awaiting",
        payment_method: "pix_online",
      })
      .eq("id", appointment_id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        payment_id: paymentId,
        pix_code: brCode,
        pix_qr_code_image: brCodeBase64,
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
