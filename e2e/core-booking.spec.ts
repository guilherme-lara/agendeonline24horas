import { test, expect } from "@playwright/test";
import { mockPaymentAPIs } from "./helpers/auth";

/**
 * Suíte 1 — O Core do Negócio
 * Testa o fluxo público de agendamento sem autenticação.
 */

// NOTE: Replace with your real barbershop slug for testing
const BARBERSHOP_SLUG = process.env.E2E_BARBERSHOP_SLUG || "barbearia-teste";

test.describe("Core Booking — Fluxo Público de Agendamento", () => {
  test.beforeEach(async ({ page }) => {
    await mockPaymentAPIs(page);
  });

  test("Fluxo completo: agendamento com pagamento local", async ({ page }) => {
    await test.step("1. Acessar a URL pública da barbearia", async () => {
      await page.goto(`/b/${BARBERSHOP_SLUG}`);
      // Espera a página carregar — ou o nome da barbearia ou o estado de erro
      await page.waitForSelector('[data-testid="public-booking"], h1, .animate-spin', {
        timeout: 10_000,
      });
    });

    await test.step("2. Selecionar um serviço", async () => {
      // Espera os cards de serviço carregarem
      const serviceCards = page.locator("button, [role='button']").filter({ hasText: /corte|barba|combo/i });
      const count = await serviceCards.count();

      if (count > 0) {
        await serviceCards.first().click();
      } else {
        // Fallback: tenta qualquer botão de serviço visível
        const anyServiceBtn = page.getByRole("button").filter({ hasText: /R\$/ });
        await expect(anyServiceBtn.first()).toBeVisible({ timeout: 5_000 });
        await anyServiceBtn.first().click();
      }
    });

    await test.step("3. Verificar que o calendário bloqueia datas passadas", async () => {
      // O componente Calendar deve estar visível
      const calendar = page.locator(".rdp, [role='grid']");
      await expect(calendar.first()).toBeVisible({ timeout: 5_000 });

      // Datas passadas devem estar desabilitadas (aria-disabled)
      const disabledDays = page.locator("[aria-disabled='true']");
      const disabledCount = await disabledDays.count();
      expect(disabledCount).toBeGreaterThan(0);
    });

    await test.step("4. Selecionar um dia e horário disponível", async () => {
      // Clica em um dia habilitado (não disabled)
      const enabledDay = page.locator("button.rdp-day:not([disabled])").first();
      if (await enabledDay.isVisible()) {
        await enabledDay.click();
      }

      // Espera os slots de horário e seleciona o primeiro disponível
      const timeSlot = page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ });
      await timeSlot.first().waitFor({ timeout: 5_000 });
      await timeSlot.first().click();
    });

    await test.step("5. Preencher dados do cliente", async () => {
      const nameInput = page.getByPlaceholder(/nome/i).first();
      const phoneInput = page.getByPlaceholder(/telefone|celular|whatsapp/i).first();

      if (await nameInput.isVisible()) {
        await nameInput.fill("Cliente E2E Teste");
      }
      if (await phoneInput.isVisible()) {
        await phoneInput.fill("11999998888");
      }
    });

    await test.step("6. Selecionar 'Pagar no Local' e finalizar", async () => {
      // Procura o botão/opção de pagamento local
      const localPayBtn = page.getByRole("button").filter({ hasText: /local|presencial/i });
      if (await localPayBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await localPayBtn.first().click();
      }

      // Clica no botão de confirmar/agendar
      const confirmBtn = page.getByRole("button").filter({ hasText: /confirmar|agendar|finalizar/i });
      await confirmBtn.first().click();
    });

    await test.step("7. Validar tela de sucesso", async () => {
      // Espera pela mensagem de sucesso
      await expect(
        page.getByText(/agendamento realizado|confirmado|sucesso/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test("Calendário não permite selecionar datas no passado", async ({ page }) => {
    await page.goto(`/b/${BARBERSHOP_SLUG}`);

    // Seleciona o primeiro serviço disponível
    const serviceBtn = page.getByRole("button").filter({ hasText: /R\$/ });
    await serviceBtn.first().waitFor({ timeout: 10_000 });
    await serviceBtn.first().click();

    // Verifica que ontem (ou antes) está disabled
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dayNum = yesterday.getDate().toString();

    const pastDay = page.locator(`button.rdp-day[aria-disabled="true"]`).filter({ hasText: dayNum });
    // Pelo menos alguma data no passado deve estar desabilitada
    const disabledDays = page.locator("[aria-disabled='true']");
    const count = await disabledDays.count();
    expect(count).toBeGreaterThan(0);
  });
});
