import { test, expect } from "@playwright/test";
import { loginAs, mockPaymentAPIs } from "./helpers/auth";

/**
 * Suíte 4 — Cadastros e Configurações
 * Testa CRUD de profissionais, serviços, estoque, clientes e configurações.
 */

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || "dono@teste.com";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || "123456";

test.describe("CRUD & Settings — Cadastros e Configurações do Admin", () => {
  test.beforeEach(async ({ page }) => {
    await mockPaymentAPIs(page);
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD, "/dashboard");
  });

  test("Gerenciamento da Equipe: adicionar barbeiro", async ({ page }) => {
    await test.step("1. Acessar Profissionais", async () => {
      await page.goto("/dashboard/profissionais");
      await expect(
        page.getByText(/equipe|profissionais/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step("2. Adicionar novo barbeiro 'Teste da Silva'", async () => {
      const addBtn = page.getByRole("button").filter({ hasText: /adicionar|novo|cadastrar|\+/i });
      await addBtn.first().click();

      // Preenche nome
      const nameInput = page.getByPlaceholder(/nome/i).first();
      await nameInput.fill("Teste da Silva");

      // Preenche comissão
      const commissionInput = page.getByPlaceholder(/comissão|%/i).first();
      if (await commissionInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await commissionInput.clear();
        await commissionInput.fill("50");
      }

      // Preenche email se disponível
      const emailInput = page.getByPlaceholder(/email|e-mail/i).first();
      if (await emailInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await emailInput.fill("teste.silva@barbershop.test");
      }

      // Salva
      const saveBtn = page.getByRole("button").filter({ hasText: /salvar|cadastrar|adicionar|criar/i });
      await saveBtn.first().click();
    });

    await test.step("3. Verificar que o barbeiro aparece na lista", async () => {
      await expect(
        page.getByText("Teste da Silva").first()
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  test("Gerenciamento de Serviços e Produtos", async ({ page }) => {
    await test.step("1. Criar novo Serviço 'Corte Teste'", async () => {
      await page.goto("/dashboard/servicos");
      await expect(
        page.getByText(/serviço|serviços/i).first()
      ).toBeVisible({ timeout: 10_000 });

      const addBtn = page.getByRole("button").filter({ hasText: /adicionar|novo|cadastrar|\+/i });
      await addBtn.first().click();

      const nameInput = page.getByPlaceholder(/nome/i).first();
      await nameInput.fill("Corte Teste");

      const priceInput = page.getByPlaceholder(/preço|valor/i).first();
      if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await priceInput.fill("50");
      }

      const saveBtn = page.getByRole("button").filter({ hasText: /salvar|cadastrar|adicionar|criar/i });
      await saveBtn.first().click();

      await expect(
        page.getByText("Corte Teste").first()
      ).toBeVisible({ timeout: 5_000 });
    });

    await test.step("2. Criar novo Produto 'Pomada Teste'", async () => {
      await page.goto("/dashboard/produtos");
      await expect(
        page.getByText(/produto|estoque|inventário/i).first()
      ).toBeVisible({ timeout: 10_000 });

      const addBtn = page.getByRole("button").filter({ hasText: /adicionar|novo|cadastrar|\+/i });
      await addBtn.first().click();

      const nameInput = page.getByPlaceholder(/nome/i).first();
      await nameInput.fill("Pomada Teste");

      const priceInput = page.getByPlaceholder(/preço|venda/i).first();
      if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await priceInput.fill("35");
      }

      const saveBtn = page.getByRole("button").filter({ hasText: /salvar|cadastrar|adicionar|criar/i });
      await saveBtn.first().click();

      await expect(
        page.getByText("Pomada Teste").first()
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  test("CRM: cadastro de cliente e aba de aniversariantes", async ({ page }) => {
    await test.step("1. Criar novo cliente", async () => {
      await page.goto("/dashboard/clientes");
      await expect(
        page.getByText(/cliente|clientes/i).first()
      ).toBeVisible({ timeout: 10_000 });

      const addBtn = page.getByRole("button").filter({ hasText: /adicionar|novo|cadastrar|\+/i });
      await addBtn.first().click();

      const nameInput = page.getByPlaceholder(/nome/i).first();
      await nameInput.fill("Cliente QA Teste");

      const phoneInput = page.getByPlaceholder(/telefone|celular|whatsapp/i).first();
      if (await phoneInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await phoneInput.fill("11988887777");
      }

      const saveBtn = page.getByRole("button").filter({ hasText: /salvar|cadastrar|adicionar|criar/i });
      await saveBtn.first().click();

      await expect(
        page.getByText("Cliente QA Teste").first()
      ).toBeVisible({ timeout: 5_000 });
    });

    await test.step("2. Verificar aba de Aniversariantes", async () => {
      await page.goto("/dashboard/aniversarios");

      // Verifica que a página carrega sem quebrar
      await page.waitForLoadState("networkidle");
      const pageContent = page.locator("main, [class*='container'], [class*='max-w']").first();
      await expect(pageContent).toBeVisible({ timeout: 5_000 });

      // Não deve ter erros visuais de crash
      const errorBoundary = page.getByText(/algo deu errado|error boundary|unexpected/i);
      await expect(errorBoundary).not.toBeVisible();
    });
  });

  test("Configurações: horário de funcionamento e pagamentos", async ({ page }) => {
    await test.step("1. Alterar horário (fechar aos domingos)", async () => {
      await page.goto("/dashboard/configuracoes");
      await expect(
        page.getByText(/configurações|ajustes/i).first()
      ).toBeVisible({ timeout: 10_000 });

      // Procura toggle de domingo
      const sundayToggle = page.locator("label, button, [role='switch']")
        .filter({ hasText: /domingo|dom/i })
        .first();

      if (await sundayToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await sundayToggle.click();
      }

      // Salva configurações
      const saveBtn = page.getByRole("button").filter({ hasText: /salvar|atualizar|aplicar/i });
      if (await saveBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        await saveBtn.first().click();
      }
    });

    await test.step("2. Verificar aba de Pagamentos", async () => {
      // Navega para a aba ou seção de pagamentos
      const paymentTab = page.getByRole("tab", { name: /pagamento/i }).or(
        page.getByText(/pagamento|infinitepay|pix/i).first()
      );

      if (await paymentTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await paymentTab.click();
      } else {
        await page.goto("/dashboard/pagamentos");
      }

      await page.waitForLoadState("networkidle");

      // Verifica que os inputs de configuração do InfinitePay renderizam
      const configElements = page.locator("input, [role='textbox']");
      const count = await configElements.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});
