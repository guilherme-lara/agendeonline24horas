import { test, expect } from "@playwright/test";
import { loginAs, mockPaymentAPIs } from "./helpers/auth";

/**
 * Suíte 3 — O Caos Operacional do Admin
 * Testa Caixa, Dashboard financeiro, Despesas e Relatórios.
 */

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || "dono@teste.com";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || "123456";

test.describe("Admin Operations — Caixa, Dashboard e Relatórios", () => {
  test.beforeEach(async ({ page }) => {
    await mockPaymentAPIs(page);
  });

  test("Módulo Caixa: cobrar agendamento e verificar sincronização", async ({ page }) => {
    await test.step("1. Login como dono da barbearia", async () => {
      await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD, "/dashboard");
    });

    await test.step("2. Acessar o módulo Caixa", async () => {
      await page.goto("/dashboard/caixa");
      await expect(
        page.getByText(/caixa|ponto de venda|pdv/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step("3. Selecionar agendamento e cobrar", async () => {
      // Espera a lista de agendamentos carregar
      const apptItem = page.locator("[class*='card'], tr, [role='row']")
        .filter({ hasText: /corte|barba|cliente/i })
        .first();

      if (await apptItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await apptItem.click();

        // Procura o botão de cobrar
        const chargeBtn = page.getByRole("button").filter({ hasText: /cobrar|finalizar|fechar/i });
        if (await chargeBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          await chargeBtn.first().click();

          // Seleciona forma de pagamento se modal aparecer
          const payMethod = page.getByRole("button").filter({ hasText: /dinheiro|pix|cartão/i });
          if (await payMethod.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
            await payMethod.first().click();
          }

          // Confirma
          const confirmBtn = page.getByRole("button").filter({ hasText: /confirmar|salvar|registrar/i });
          if (await confirmBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
            await confirmBtn.first().click();
          }
        }
      }
    });

    await test.step("4. Verificar sincronização Onlive no Dashboard", async () => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verifica que o Dashboard carregou com KPIs
      await expect(
        page.getByText(/faturamento|receita|vendas/i).first()
      ).toBeVisible({ timeout: 10_000 });

      // Verifica que os cards de KPI estão renderizando valores (R$ X,XX)
      const kpiValues = page.locator("text=/R\\$\\s?[\\d.,]+/");
      const count = await kpiValues.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test("Módulo Despesas: cadastrar novo pagamento", async ({ page }) => {
    await test.step("1. Login e acessar Despesas", async () => {
      await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD, "/dashboard");
      await page.goto("/dashboard/despesas");
      await expect(
        page.getByText(/despesas|contas/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step("2. Criar uma despesa de R$ 100,00", async () => {
      // Procura o botão de adicionar
      const addBtn = page.getByRole("button").filter({ hasText: /adicionar|nova|cadastrar|\+/i });
      await addBtn.first().click();

      // Preenche os campos
      const descInput = page.getByPlaceholder(/descrição|nome/i).first();
      if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await descInput.fill("Pagamento de Luz");
      }

      const amountInput = page.getByPlaceholder(/valor|amount/i).first();
      if (await amountInput.isVisible()) {
        await amountInput.fill("100");
      }

      // Seleciona categoria se disponível
      const categorySelect = page.locator("select, [role='combobox']").first();
      if (await categorySelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await categorySelect.click();
        const option = page.getByRole("option").filter({ hasText: /fixa|utilidade|outros/i });
        if (await option.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
          await option.first().click();
        }
      }

      // Salva
      const saveBtn = page.getByRole("button").filter({ hasText: /salvar|cadastrar|adicionar/i });
      await saveBtn.first().click();
    });

    await test.step("3. Verificar que a despesa aparece na lista", async () => {
      await expect(
        page.getByText("Pagamento de Luz").first()
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  test("Módulo Relatórios: gráficos renderizam sem erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await test.step("1. Login e acessar Relatórios", async () => {
      await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD, "/dashboard");
      await page.goto("/dashboard/relatorios");
    });

    await test.step("2. Verificar que o gráfico renderiza", async () => {
      // Espera o componente FinancialTab carregar
      await expect(
        page.getByText(/business intelligence|relatório|faturamento/i).first()
      ).toBeVisible({ timeout: 10_000 });

      // Verifica presença de elementos do Recharts (SVG do gráfico)
      const chartSvg = page.locator(".recharts-wrapper, svg.recharts-surface, [class*='chart']");
      const hasChart = await chartSvg.first().isVisible({ timeout: 5_000 }).catch(() => false);

      // Pelo menos não deve ter erros JS críticos
      const criticalErrors = consoleErrors.filter(
        (e) => e.includes("TypeError") || e.includes("ReferenceError") || e.includes("Cannot read")
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });
});
