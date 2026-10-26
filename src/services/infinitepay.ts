import { supabase } from "@/integrations/supabase/client";

export interface InfinitePayChargeRequest {
  amount: number;
  document_number?: string;
  first_name: string;
  last_name: string;
  appointment_id?: string;
  barbershop_id: string;
}

export interface InfinitePayChargeResponse {
  success: boolean;
  mode?: "static" | "infinitepay";
  brcode?: string;
  qr_code_base64?: string;
  payment_id?: string;
  pix_key?: string;
  pix_beneficiary?: string;
  details?: string;
  http_status?: number;
  error?: string;
}

export const createInfinitePayCharge = async (
  request: InfinitePayChargeRequest,
): Promise<InfinitePayChargeResponse> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    return { success: false, error: "Faça login para gerar uma cobrança Pix." };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/create-pix-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
  });

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    return { success: false, error: "Resposta inválida ao gerar a cobrança Pix." };
  }

  if (!response.ok) {
    console.error("create-pix-charge returned an error:", response.status);
    return {
      success: false,
      error: typeof data.error === "string" ? data.error : "Erro ao gerar cobrança",
      ...(typeof data.details === "string" && { details: data.details }),
      ...(typeof data.http_status === "number" && { http_status: data.http_status }),
    };
  }

  return {
    success: true,
    mode: data.mode === "static" ? "static" : "infinitepay",
    brcode: typeof data.brcode === "string" ? data.brcode : "",
    qr_code_base64: typeof data.qr_code_base64 === "string" ? data.qr_code_base64 : "",
    payment_id: typeof data.payment_id === "string" ? data.payment_id : "",
    pix_key: typeof data.pix_key === "string" ? data.pix_key : "",
    pix_beneficiary: typeof data.pix_beneficiary === "string" ? data.pix_beneficiary : "",
  };
};
