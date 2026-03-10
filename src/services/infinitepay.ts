/**
 * Serviço InfinitePay — Prepara o payload para a Edge Function de cobrança Pix.
 */

export interface InfinitePayChargeRequest {
  amount: number; // em centavos
  document_number: string; // CPF do cliente
  first_name: string;
  last_name: string;
  appointment_id: string;
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
  error?: string;
}

/**
 * Chama a Edge Function `create-pix-charge` com payload InfinitePay.
 */
export const createInfinitePayCharge = async (
  request: InfinitePayChargeRequest
): Promise<InfinitePayChargeResponse> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-pix-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      appointment_id: request.appointment_id,
      barbershop_id: request.barbershop_id,
      amount: request.amount,
      document_number: request.document_number,
      first_name: request.first_name,
      last_name: request.last_name,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.error || "Erro ao gerar cobrança" };
  }

  return {
    success: true,
    mode: data.mode || "infinitepay",
    brcode: data.brcode || data.pix_code || "",
    qr_code_base64: data.qr_code_base64 || data.pix_qr_code_image || "",
    payment_id: data.payment_id || "",
    pix_key: data.pix_key || "",
    pix_beneficiary: data.pix_beneficiary || "",
  };
};
