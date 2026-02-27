import { useNavigate } from "react-router-dom";
import { CheckCircle, Home, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const BookingSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="container max-w-md py-20 text-center animate-scale-in">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full gold-gradient shadow-gold">
        <CheckCircle className="h-10 w-10 text-primary-foreground" />
      </div>
      
      <h1 className="font-display text-3xl font-bold mb-3">Agendamento Confirmado!</h1>
      
      <p className="text-muted-foreground mb-10">
        Seu horário foi reservado com sucesso. Você receberá uma confirmação em breve por e-mail ou WhatsApp.
      </p>

      <div className="flex flex-col gap-3">
        <Button
          onClick={() => navigate("/meus-agendamentos")}
          className="gold-gradient text-primary-foreground font-semibold hover:opacity-90"
        >
          <CalendarDays className="mr-2 h-4 w-4" /> Meus Agendamentos
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => navigate("/")}
          className="hover:bg-secondary"
        >
          <Home className="mr-2 h-4 w-4" /> Voltar ao Início
        </Button>
      </div>
    </div>
  );
};

export default BookingSuccess;
