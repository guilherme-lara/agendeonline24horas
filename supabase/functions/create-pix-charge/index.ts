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
    const { appointment_id, barbershop_id, amount, document_number, first_name, last_name } = await req.json();

    if (!appointment_id || !barbershop_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id and barbershop_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca dados da barbearia (sem secrets)
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

    // Busca dados do agendamento
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

    // 🔒 SEGURANÇA: Busca o token InfinitePay da tabela de secrets (não do settings público)
    const { data: secrets } = await supabase
      .from("barbershop_secrets")
      .select("infinitepay_token")
      .eq("barbershop_id", barbershop_id)
      .maybeSingle();

    const infinitePayToken = secrets?.infinitepay_token || "";
    const settings = (shop.settings as Record<string, unknown>) || {};

    // Se não tem token InfinitePay, retorna a chave Pix estática do admin
    if (!infinitePayToken) {
      const pixKey = (settings.pix_key as string) || "";
      const pixBeneficiary = (settings.pix_beneficiary as string) || shop.name;

      await supabase
        .from("appointments")
        .update({
          payment_status: "awaiting",
          payment_method: "pix_static",
        })
        .eq("id", appointment_id);

      return new Response(
        JSON.stringify({
          success: true,
          mode: "static",
          pix_key: pixKey,
          pix_beneficiary: pixBeneficiary,
          brcode: "",
          qr_code_base64: "",
          payment_id: "",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- INTEGRAÇÃO INFINITEPAY ---
    const priceInCents = amount || Math.round(Number(appt.price) * 100);

    console.log("Creating InfinitePay charge...", { priceInCents, document_number, first_name, last_name });

    const infinitePayRes = await fetch("https://api.infinitepay.io/v2/pix/qrcode", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${infinitePayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: priceInCents,
        document_number: document_number || "",
        first_name: first_name || appt.client_name?.split(" ")[0] || "",
        last_name: last_name || appt.client_name?.split(" ").slice(1).join(" ") || "",
        description: `${appt.service_name} - ${shop.name}`,
      }),
    });

    const infinitePayData = await infinitePayRes.json();
    console.log("InfinitePay response:", JSON.stringify(infinitePayData));

    if (!infinitePayRes.ok) {
      console.error("InfinitePay error:", infinitePayData);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar cobrança InfinitePay", details: infinitePayData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brcode = infinitePayData.brcode || infinitePayData.pix_code || "";
    const qrCodeBase64 = infinitePayData.qr_code_base64 || infinitePayData.qr_code || "";
    const paymentId = infinitePayData.id || infinitePayData.payment_id || "";

    await supabase
      .from("appointments")
      .update({
        payment_id: paymentId || null,
        payment_status: "awaiting",
        payment_method: "pix_infinitepay",
        pix_code: brcode || null,
      })
      .eq("id", appointment_id);

    return new Response(
      JSON.stringify({
        success: true,
        mode: "infinitepay",
        brcode,
        qr_code_base64: qrCodeBase64,
        payment_id: paymentId,
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
