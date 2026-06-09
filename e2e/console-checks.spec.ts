import { test, expect } from "@playwright/test";

/**
 * Suíte de verificação de console (CI Gate)
 * Garante que os fluxos críticos — agendamento público e a tela /dashboard/clientes —
 * não emitam erros/warnings no console do navegador nem erros de página (uncaught).
 */

const BARBERSHOP_SLUG = process.env.E2E_BARBERSHOP_SLUG || "barbearia-teste";

// Ruídos conhecidos de terceiros que não indicam regressão real.
const IGNORE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /service worker/i,
  /Failed to load resource/i, // recursos externos (ex.: avatar ausente) não devem falhar o gate
  /manifest/i,
];

function attachConsoleGuard(page: import("@playwright/test").Page) {
  const problems: string[] = [];

  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (IGNORE_PATTERNS.some((re) => re.test(text))) return;
    problems.push(`[console.${type}] ${text}`);
  });

  page.on("pageerror", (err) => {
    problems.push(`[pageerror] ${err.message}`);
  });

  return problems;
}

test.describe("Console Checks — Gate de CI", () => {
  test("Fluxo de booking público não gera erros de console", async ({ page }) => {
    const problems = attachConsoleGuard(page);

    await page.goto(`/b/${BARBERSHOP_SLUG}`);
    await page.waitForLoadState("networkidle");

    // Interage minimamente para exercitar render de serviços/profissionais.
    await page.waitForTimeout(1500);

    expect(problems, `Problemas de console detectados no booking:\n${problems.join("\n")}`).toEqual([]);
  });

  test("Tela /dashboard/clientes não gera erros de console", async ({ page }) => {
    const problems = attachConsoleGuard(page);

    await page.goto("/dashboard/clientes");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Rotas autenticadas podem redirecionar para /login; isso é aceitável.
    // O foco é garantir ausência de erros de runtime durante o render.
    expect(problems, `Problemas de console detectados em clientes:\n${problems.join("\n")}`).toEqual([]);
  });
});
