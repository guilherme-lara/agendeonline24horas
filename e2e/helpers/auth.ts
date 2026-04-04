import { Page, expect } from "@playwright/test";

/**
 * Login helper — performs email/password login through the UI.
 * Waits for redirect to confirm success.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectedPath: string
) {
  await page.goto("/login");
  await page.getByPlaceholder("contato@barbearia.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /entrar no sistema/i }).click();
  await page.waitForURL(`**${expectedPath}**`, { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(expectedPath));
}

/**
 * Mock external payment APIs to avoid real charges during E2E tests.
 */
export async function mockPaymentAPIs(page: Page) {
  await page.route("**/functions/v1/create-pix-charge", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        brcode: "00020126580014br.gov.bcb.pix0136mock-pix-key-12345",
        qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        payment_id: "mock-payment-id",
        mode: "infinitepay",
      }),
    })
  );

  await page.route("**/functions/v1/infinitepay-webhook", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", message: "Webhook ativo (mock)" }),
    })
  );
}
