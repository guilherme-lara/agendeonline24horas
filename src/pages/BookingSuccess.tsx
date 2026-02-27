import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Home, CalendarDays, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const BookingSuccess = () => {
  const navigate = useNavigate();
  const { slug } = useParams(); // Pega o slug da barbearia pela URL

  return (
    <div className="container max-w-md min-h-[80vh] flex flex-col items-center justify-center py-10 px-6 animate-in fade-in zoom-in-95 duration-500">
      {/* ÍCONE DE SUCESSO COM EFEITO NEON */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-transform hover:scale-110 duration-300">
          <CheckCircle2 className="h-14 w-14 text-white" />
        </div>
      </div>
      
      <h1 className="text-3xl font-black text-white mb-3 tracking-tight text-center">
        Tudo Certo!
      </h1>
      
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 mb-10 backdrop-blur-sm shadow-xl text-center">
        <p className="text-slate-400 text-sm leading-relaxed">
          Seu horário foi reservado com sucesso. Preparamos tudo para te receber com a melhor experiência.
        </p>
        
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col items-center gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dica importante</p>
            <p className="text-xs text-cyan-400 font-medium flex items-center gap-2">
                <MessageSquare className="h-3 w-3" /> Verifique seu WhatsApp para o lembrete
            </p>
        </div>
      </div>

      <div className="flex flex-col w-full gap-4">
        <Button
          onClick={() => navigate(`/agendamentos/${slug}`)}
          className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95 group"
        >
          <CalendarDays className="mr-2 h-5 w-5" /> 
          Ver Meus Agendamentos
          <ArrowRight className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/agendamentos/${slug}`)}
          className="h-14 text-slate-500 hover:text-white hover:bg-slate-900 font-bold rounded-2xl transition-all"
        >
          <Home className="mr-2 h-5 w-5" /> Voltar ao Início
        </Button>
      </div>

      <p className="mt-12 text-[10px] text-slate-700 font-bold uppercase tracking-tighter">
        Powered by Barbershop SaaS System
      </p>
    </div>
  );
};

export default BookingSuccess;
