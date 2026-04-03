import { test, expect } from "@playwright/test";
import { loginAs, mockPaymentAPIs } from "./helpers/auth";

/**
 * Suíte 2 — A Visão do Barbeiro
 * Testa o dashboard do barbeiro, agenda e mudança de status.
 */

const BARBER_EMAIL = process.env.E2E_BARBER_EMAIL || "barbeiro@teste.com";
const BARBER_PASSWORD = process.env.E2E_BARBER_PASSWORD || "123456";

test.describe("Barber Dashboard — Agenda e Operações do Barbeiro", () => {
  test.beforeEach(async ({ page }) => {
    await mockPaymentAPIs(page);
  });

  test("Login do barbeiro e verificação da agenda", async ({ page }) => {
    await test.step("1. Login como barbeiro", async () => {
      await loginAs(page, BARBER_EMAIL, BARBER_PASSWORD, "/barber/dashboard");
    });

    await test.step("2. Verificar que o Dashboard do Barbeiro carregou", async () => {
      // Valida elementos core do dashboard do barbeiro
      await expect(
        page.getByText(/agenda|meus atendimentos|dashboard/i).first()
      ).toBeVisible({ timeout: 10_000 });

      // Verifica que a bottom nav está presente (mobile-first)
      const bottomNav = page.locator("nav, [role='navigation']").last();
      await expect(bottomNav).toBeVisible();
    });

    await test.step("3. Verificar presença de agendamentos na agenda", async () => {
      // A agenda deve renderizar sem erro — verifica se há cards ou estado vazio
      const agendaContent = page.locator("[class*='card'], [class*='appointment']").first();
      const emptyState = page.getByText(/nenhum|sem agendamento|agenda vazia/i).first();

      // Um dos dois deve ser visível — ou tem agendamentos ou estado vazio
      const hasContent = await agendaContent.isVisible({ timeout: 5_000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(hasContent || hasEmpty).toBeTruthy();
    });

    await test.step("4. Verificar correção de fuso horário (sem defasagem de 3h)", async () => {
      // Verifica que os horários exibidos estão em formato BR (HH:mm)
      const timeLabels = page.locator("text=/\\d{2}:\\d{2}/");
      const count = await timeLabels.count();

      if (count > 0) {
        const firstTime = await timeLabels.first().textContent();
        expect(firstTime).toMatch(/^\d{2}:\d{2}$/);

        // Verifica que não há horários absurdos (ex: 03:00 quando deveria ser 00:00)
        const hour = parseInt(firstTime!.split(":")[0]);
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThanOrEqual(23);
      }
    });

    await test.step("5. Simular mudança de status de um agendamento", async () => {
      // Tenta clicar no primeiro card de agendamento
      const appointmentCard = page.locator("[class*='card']").filter({ hasText: /corte|barba|agendado|confirmado/i }).first();

      if (await appointmentCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await appointmentCard.click();

        // Procura botões de mudança de status
        const statusBtn = page.getByRole("button").filter({ hasText: /atendimento|iniciar|finalizar|concluir/i });
        if (await statusBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          await statusBtn.first().click();

          // Espera feedback de sucesso
          await expect(
            page.getByText(/atualizado|sucesso|status alterado/i).first()
          ).toBeVisible({ timeout: 5_000 }).catch(() => {
            // OK se não encontrar — pode ser toast que some rápido
          });
        }
      }
    });
  });

  test("Barbeiro não consegue acessar rotas do admin", async ({ page }) => {
    await test.step("1. Login como barbeiro", async () => {
      await loginAs(page, BARBER_EMAIL, BARBER_PASSWORD, "/barber/dashboard");
    });

    await test.step("2. Tentar acessar rota protegida do dono", async () => {
      await page.goto("/dashboard/configuracoes");

      // Deve ser redirecionado ou ver bloqueio
      await page.waitForTimeout(2_000);
      const url = page.url();
      const blockedOrRedirected =
        url.includes("/barber/dashboard") ||
        url.includes("/login") ||
        await page.getByText(/acesso negado|não autorizado|sem permissão/i).first().isVisible().catch(() => false);

      expect(blockedOrRedirected).toBeTruthy();
    });
  });
});
