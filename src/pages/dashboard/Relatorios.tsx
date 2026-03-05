import FinancialTab from "@/components/FinancialTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, AlertTriangle, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const Relatorios = () => {
  // Utilizamos os estados do hook blindado com TanStack Query
  const { barbershop, loading, isError, refetch } = useBarbershop() as any;

  // Proteção contra loading infinito
  const queryEnabled = !!barbershop?.id;

  // --- RENDERS DE PROTEÇÃO ---
  if (loading && queryEnabled && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">
          Consolidando dados financeiros...
        </p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
        <p className="text-sm text-slate-400 mb-8">
          Não conseguimos carregar as métricas da sua barbearia.
        </p>
        <Button onClick={() => refetch()} className="gold-gradient px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* CABEÇALHO PREMIUM */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20">
            <BarChart3 className="h-7 w-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Business Intelligence</h1>
            <p className="text-slate-500 text-sm font-medium">
              Analise sua lucratividade, ticket médio e performance da equipe.
            </p>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Status do Caixa</p>
                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Sincronizado</p>
            </div>
        </div>
      </div>

      {/* CONTAINER PRINCIPAL */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-2 md:p-6 backdrop-blur-sm shadow-xl">
        {/* O FinancialTab gerencia os gráficos, filtros de data e exportações */}
        <FinancialTab barbershopId={barbershop.id} />
      </div>

      <div className="mt-8 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Dados atualizados em tempo real com base no fechamento das comandas
          </p>
        </div>
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          Conselho: Revise suas despesas semanalmente para manter o ROI positivo.
        </p>
      </div>
    </div>
  );
};

export default Relatorios;
