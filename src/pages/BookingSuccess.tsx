import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Home, CalendarDays, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const BookingSuccess = () => {
  const navigate = useNavigate();
  const { slug } = useParams();

  return (
    <div className="container max-w-md min-h-[80vh] flex flex-col items-center justify-center py-10 px-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-transform hover:scale-110 duration-300">
          <CheckCircle2 className="h-14 w-14 text-white" />
        </div>
      </div>
      
      <h1 className="text-3xl font-black text-foreground mb-3 tracking-tight text-center font-display">
        Tudo Certo!
      </h1>
      
      <div className="bg-card border border-border rounded-3xl p-6 mb-10 shadow-card text-center">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Seu horário foi reservado com sucesso. Preparamos tudo para te receber com a melhor experiência.
        </p>
        
        <div className="mt-6 pt-6 border-t border-border flex flex-col items-center gap-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dica importante</p>
            <p className="text-xs text-primary font-medium flex items-center gap-2">
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
          className="h-14 text-muted-foreground hover:text-foreground hover:bg-secondary font-bold rounded-2xl transition-all"
        >
          <Home className="mr-2 h-5 w-5" /> Voltar ao Início
        </Button>
      </div>

      <p className="mt-12 text-[10px] text-muted-foreground/50 font-bold uppercase tracking-tighter">
        Powered by Agende Online 24h
      </p>
    </div>
  );
};

export default BookingSuccess;
