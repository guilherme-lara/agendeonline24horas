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

    console.log("📥 Request payload:", JSON.stringify({ appointment_id, barbershop_id, amount, document_number, first_name, last_name }));

    if (!appointment_id || !barbershop_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id and barbershop_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca dados da barbearia
    const { data: shop, error: shopErr } = await supabase
      .from("barbershops")
      .select("settings, name, slug")
      .eq("id", barbershop_id)
      .single();

    if (shopErr || !shop) {
      console.error("❌ Barbearia não encontrada:", shopErr);
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
      console.error("❌ Agendamento não encontrado:", apptErr);
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔒 Busca o token InfinitePay da tabela de secrets
    const { data: secrets, error: secretsErr } = await supabase
      .from("barbershop_secrets")
      .select("infinitepay_token")
      .eq("barbershop_id", barbershop_id)
      .maybeSingle();

    if (secretsErr) {
      console.error("❌ Erro ao buscar secrets:", secretsErr);
    }

    const infinitePayToken = secrets?.infinitepay_token || "";
    const settings = (shop.settings as Record<string, unknown>) || {};

    // Se não tem token InfinitePay, retorna a chave Pix estática do admin
    if (!infinitePayToken) {
      console.log("ℹ️ Sem token InfinitePay, usando Pix estático");
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

    // 1. AMOUNT: garantir inteiro em centavos
    const rawPrice = amount || Number(appt.price) || 0;
    // Se o valor parecer estar em reais (< 1000 e tem decimais), converter para centavos
    const priceInCents = Number.isInteger(rawPrice) && rawPrice >= 100
      ? rawPrice
      : Math.round(rawPrice * 100);

    // 2. SANITIZAÇÃO: remover caracteres especiais do document_number
    const sanitizedDoc = (document_number || "").replace(/[^0-9]/g, "");

    // 3. NOMES: garantir strings limpas
    const clientFirstName = (first_name || appt.client_name?.split(" ")[0] || "Cliente").trim();
    const clientLastName = (last_name || appt.client_name?.split(" ").slice(1).join(" ") || "").trim() || "N";

    // 4. DESCRIÇÃO: sanitizar para evitar caracteres problemáticos
    const description = `${(appt.service_name || "Servico").replace(/[^\w\sÀ-ú-]/g, "")} - ${(shop.name || "Barbearia").replace(/[^\w\sÀ-ú-]/g, "")}`;

    const payload = {
      amount: priceInCents,
      document_number: sanitizedDoc,
      first_name: clientFirstName,
      last_name: clientLastName,
      description,
    };

    console.log("🚀 InfinitePay request payload:", JSON.stringify(payload));
    console.log("🔑 Token present:", !!infinitePayToken, "| Token length:", infinitePayToken.length);

    const infinitePayRes = await fetch("https://api.infinitepay.io/v2/pix/qrcode", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${infinitePayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await infinitePayRes.text();
    console.log("📡 InfinitePay HTTP status:", infinitePayRes.status);
    console.log("📡 InfinitePay response headers:", JSON.stringify(Object.fromEntries(infinitePayRes.headers.entries())));
    console.log("📡 InfinitePay response body:", responseText);

    let infinitePayData: Record<string, unknown>;
    try {
      infinitePayData = JSON.parse(responseText);
    } catch {
      console.error("❌ Failed to parse InfinitePay response as JSON:", responseText);
      return new Response(
        JSON.stringify({
          error: "Resposta inválida da InfinitePay",
          details: responseText.substring(0, 500),
          http_status: infinitePayRes.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!infinitePayRes.ok) {
      console.error("❌ InfinitePay API error:", {
        status: infinitePayRes.status,
        statusText: infinitePayRes.statusText,
        response: infinitePayData,
        sentPayload: { ...payload, document_number: sanitizedDoc ? `***${sanitizedDoc.slice(-4)}` : "empty" },
      });

      // Mensagem de erro mais descritiva
      let errorMsg = "Erro ao gerar cobrança InfinitePay";
      if (infinitePayRes.status === 401 || infinitePayRes.status === 403) {
        errorMsg = "Token InfinitePay inválido ou expirado. Verifique suas credenciais.";
      } else if (infinitePayRes.status === 422) {
        errorMsg = "Dados inválidos para gerar o Pix. Verifique CPF e valores.";
      }

      return new Response(
        JSON.stringify({
          error: errorMsg,
          details: infinitePayData,
          http_status: infinitePayRes.status,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brcode = (infinitePayData.brcode || infinitePayData.pix_code || "") as string;
    const qrCodeBase64 = (infinitePayData.qr_code_base64 || infinitePayData.qr_code || "") as string;
    const paymentId = (infinitePayData.id || infinitePayData.payment_id || "") as string;

    console.log("✅ Pix charge created successfully:", { paymentId, brcodeLength: brcode.length });

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
    console.error("💥 Unhandled error in create-pix-charge:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
