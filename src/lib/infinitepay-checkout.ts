// InfinitePay Checkout URLs for SaaS subscriptions
// Handle: ribeiro-guilherme-11k

const INFINITEPAY_HANDLE = "ribeiro-guilherme-11k";

export const PLAN_CHECKOUT_URLS: Record<string, { url: string; price: string; label: string }> = {
  bronze: {
    url: `https://pay.infinitepay.io/${INFINITEPAY_HANDLE}/49-90`,
    price: "R$ 49,90",
    label: "Bronze",
  },
  prata: {
    url: `https://pay.infinitepay.io/${INFINITEPAY_HANDLE}/79-90`,
    price: "R$ 79,90",
    label: "Prata",
  },
  ouro: {
    url: `https://pay.infinitepay.io/${INFINITEPAY_HANDLE}/99-90`,
    price: "R$ 99,90",
    label: "Ouro",
  },
};

/**
 * Opens InfinitePay checkout with barbershop_id as reference
 */
export const openPlanCheckout = (planKey: string, barbershopId?: string) => {
  const plan = PLAN_CHECKOUT_URLS[planKey.toLowerCase()];
  if (!plan) return;

  // Append barbershop_id as query param for webhook identification
  const url = new URL(plan.url);
  if (barbershopId) {
    url.searchParams.set("ref", barbershopId);
  }

  window.open(url.toString(), "_blank");
};
