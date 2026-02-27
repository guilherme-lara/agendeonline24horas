import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Scissors, Home, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Log profissional para monitoramento de rotas quebradas
    console.error(
      `[404 System] Tentativa de acesso a rota inexistente: ${location.pathname}`
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0b1224] flex items-center justify-center px-6 relative overflow-hidden">
      {/* EFEITOS DE FUNDO NEON */}
      <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-cyan-500/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-red-500/5 blur-[120px] rounded-full" />

      <div className="w-full max-w-md z-10 text-center animate-in fade-in zoom-in-95 duration-500">
        {/* ÍCONE COM EFEITO GHOST/ERROR */}
        <div className="relative mb-10 group">
          <div className="absolute inset-0 bg-red-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
          <div className="relative h-24 w-24 mx-auto flex items-center justify-center rounded-[2rem] bg-slate-900 border border-slate-800 shadow-2xl transition-transform hover:rotate-12">
            <Scissors className="h-12 w-12 text-slate-700" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1 w-16 bg-red-500/40 rotate-45 rounded-full absolute" />
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-10">
          <h1 className="text-6xl font-black text-white tracking-tighter">404</h1>
          <h2 className="text-xl font-bold text-slate-200">Caminho não encontrado</h2>
          <p className="text-sm text-slate-500 max-w-[280px] mx-auto leading-relaxed">
            A página <span className="text-cyan-500 font-mono italic">{location.pathname}</span> foi removida ou nunca existiu em nossa base.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate("/")}
            className="h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95"
          >
            <Home className="mr-2 h-5 w-5" /> 
            Voltar ao Dashboard
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="h-12 text-slate-500 hover:text-white hover:bg-slate-900 font-bold rounded-xl transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Retornar de onde parei
          </Button>
        </div>

        {/* ASSINATURA TECH */}
        <div className="mt-16 flex items-center justify-center gap-2 opacity-30">
            <AlertCircle className="h-3 w-3 text-slate-500" />
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
              Master System Error Handler &bull; 2026
            </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
