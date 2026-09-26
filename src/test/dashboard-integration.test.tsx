import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ==============================================================================
// 1. MOCKS DE MÓDULOS EXTERNOS E HOOKS INTERNOS
// ==============================================================================

// Mock do Supabase Client para validar os filtros (RBAC) e retornos
const mockEq = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();
const mockLte = vi.fn().mockReturnThis();
const mockNeq = vi.fn().mockReturnThis();
const mockIn = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockImplementation((count?: number) => mockOrder());
const mockOrder = vi.fn().mockImplementation(() => {
  const promise = Promise.resolve({ data: [], error: null });
  return Object.assign(promise, { limit: mockLimit });
});
const mockSelect = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      neq: mockNeq,
      in: mockIn,
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle
    })),
  },
}));

// Mock do hook useAuth
const mockUseAuth = {
  user: { id: "user-123", email: "test@lux.com" },
  isAdmin: false,
  isProfessional: false,
};
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth,
}));

// Mock do hook useClinic
const mockUseClinic = {
  clinic: { id: "clinic-1", name: "Lux Clinic", plan_name: "premium", plan_status: "active" },
  loading: false,
  professionalId: null as string | null,
  clearImpersonation: vi.fn(),
};
vi.mock("@/hooks/useClinic", () => ({
  useClinic: () => mockUseClinic,
}));

// Mock Sound Feedback and Toast
vi.mock("@/hooks/useSoundFeedback", () => ({
  useSoundFeedback: () => ({ playCaching: vi.fn(), playSuccess: vi.fn() }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Import component after mocks
import Dashboard from "@/pages/Dashboard";
import Caixa from "@/pages/dashboard/Caixa";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

// ==============================================================================
// 2. SUÍTE DE TESTES DE INTEGRAÇÃO (UI + LÓGICA)
// ==============================================================================

describe("Integration Tests: Dashboard & Caixa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  // -------------------------------------------------------------------------
  // TESTE 1: DASHBOARD COMO DONO (OWNER)
  // -------------------------------------------------------------------------
  it("Deve renderizar Dashboard do Dono e somar TODAS as movimentações de caixa da clínica", async () => {
    // Setup Role: Owner
    mockUseAuth.isProfessional = false;
    mockUseClinic.professionalId = null;

    // Supabase DB Mock: Retorna 3 cash_movements somando R$ 600
    mockOrder.mockImplementationOnce(() => {
      const p = Promise.resolve({ data: [] });
      return Object.assign(p, { limit: mockLimit });
    }); // dashboard-appointments
    mockOrder.mockImplementationOnce(() => {
      const p = Promise.resolve({
        data: [
          { id: "cm1", amount: 200, movement_type: "sale", created_at: new Date().toISOString() },
          { id: "cm2", amount: 100, movement_type: "sale", created_at: new Date().toISOString() },
          { id: "cm3", amount: 300, movement_type: "sale", created_at: new Date().toISOString() },
        ],
        error: null
      });
      return Object.assign(p, { limit: mockLimit });
    }); // dashboard-cash-movements

    renderWithProviders(<Dashboard />);

    // Verifica se a tela renderizou os R$ 600 corretos
    const totals = await screen.findAllByText(/600/);
    expect(totals.length).toBeGreaterThan(0);
    
    // Verifica se a query Supabase NÃO foi filtrada por barber_id (pois é dono)
    const calls = mockEq.mock.calls;
    const hasBarberFilter = calls.some(call => call[0] === "barber_id");
    expect(hasBarberFilter).toBe(false); // O Dono varre toda a clínica
  });

  // -------------------------------------------------------------------------
  // TESTE 2: DASHBOARD COMO PROFISSIONAL
  // -------------------------------------------------------------------------
  it("Deve renderizar Dashboard do Profissional, aplicando filtro RBAC em appointments", async () => {
    // Setup Role: Profissional
    mockUseAuth.isProfessional = true;
    mockUseClinic.professionalId = "prof-999";

    // Supabase DB Mock: Retorna 1 appointment do profissional e cash_movements
    mockOrder.mockImplementationOnce(() => {
      const p = Promise.resolve({
        data: [
          { id: "a1", price: 200, total_price: 200, status: "completed", scheduled_at: new Date().toISOString(), barber_id: "prof-999" }
        ],
        error: null
      });
      return Object.assign(p, { limit: mockLimit });
    }); // dashboard-appointments
    mockOrder.mockImplementationOnce(() => {
      const p = Promise.resolve({
        data: [
          { id: "cm1", amount: 200, movement_type: "sale", created_at: new Date().toISOString() },
        ],
        error: null
      });
      return Object.assign(p, { limit: mockLimit });
    }); // dashboard-cash-movements

    renderWithProviders(<Dashboard />);

    // Verifica a UI
    const totals = await screen.findAllByText(/200/);
    expect(totals.length).toBeGreaterThan(0);

    // VALIDAÇÃO CRÍTICA DO FILTRO RBAC:
    // Verifica se o componente chamou supabase.from('appointments').eq('barber_id', 'prof-999')
    const calls = mockEq.mock.calls;
    const appliedBarberFilter = calls.some(call => call[0] === "barber_id" && call[1] === "prof-999");
    
    expect(appliedBarberFilter).toBe(true); // O Profissional foi restringido em appointments!
  });

  // -------------------------------------------------------------------------
  // TESTE 3: FRENTE DE CAIXA (LISTAGEM DE CLIENTES COM FILTRO)
  // -------------------------------------------------------------------------
  it("Deve listar agendamentos no Caixa filtrados pelo Profissional", async () => {
    // Setup Role: Profissional
    mockUseAuth.isProfessional = true;
    mockUseClinic.professionalId = "prof-999";

    // Mock das queries do Caixa (daily-appointments, inventory)
    mockOrder.mockResolvedValueOnce({
      data: [
        { id: "appt-1", client_name: "Cliente VIP 1", service_name: "Corte", status: "confirmed", price: 50 },
      ],
      error: null
    }); // appointments query

    renderWithProviders(<Caixa />);

    // Verifica se a tela renderizou o cliente retornado pelo banco mockado
    const clientElements = await screen.findAllByText("Cliente VIP 1");
    expect(clientElements.length).toBeGreaterThan(0);

    // Valida se a listagem do Caixa blindou o retorno exigindo `barber_id = prof-999`
    const calls = mockEq.mock.calls;
    const appliedBarberFilter = calls.some(call => call[0] === "barber_id" && call[1] === "prof-999");
    
    expect(appliedBarberFilter).toBe(true); 
  });

  // -------------------------------------------------------------------------
  // TESTE 4: AÇÃO DE COBRANÇA NA UI (USER EVENT)
  // -------------------------------------------------------------------------
  it("Deve abrir a tela lateral de carrinho ao clicar em 'Cobrar'", async () => {
    mockUseAuth.isProfessional = false;
    mockUseClinic.professionalId = null;

    mockOrder.mockResolvedValueOnce({
      data: [
        { id: "appt-2", client_name: "João Silva", service_name: "Pacote Lux", status: "confirmed", price: 100 },
      ],
      error: null
    });

    renderWithProviders(<Caixa />);

    // Encontra o botão "Cobrar" usando a library de dom
    const cobrarBtn = await screen.findByRole("button", { name: /Cobrar/i });
    expect(cobrarBtn).toBeInTheDocument();

    // Interação do usuário
    await userEvent.click(cobrarBtn);

    // Quando clica em cobrar, o carrinho abre.
    // O nome 'João Silva' deve aparecer agora DUAS vezes na tela: uma na listagem <p> e uma no título <h2> do carrinho.
    const clientNameElements = await screen.findAllByText("João Silva");
    expect(clientNameElements.length).toBe(2);
  });
});
