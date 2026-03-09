import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, Cake, Phone, MessageCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Customer { id: string; name: string; phone: string; birth_date: string; }

const Aniversarios = () => {
  const { barbershop } = useBarbershop();
  const queryEnabled = !!barbershop?.id;

  const { data: customers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["birthdays", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase.from("customers").select("id, name, phone, birth_date").eq("barbershop_id", barbershop.id).not("birth_date", "is", null);
      if (error) throw error;
      const currentMonth = new Date().getMonth() + 1;
      const birthdayThisMonth = ((data as Customer[]) || []).filter((c) => {
        if (!c.birth_date) return false;
        return new Date(c.birth_date + "T00:00").getMonth() + 1 === currentMonth;
      });
      return birthdayThisMonth.sort((a, b) => new Date(a.birth_date + "T00:00").getDate() - new Date(b.birth_date + "T00:00").getDate());
    },
    enabled: !!barbershop?.id,
    staleTime: 1000 * 60 * 30,
  });

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const msg = encodeURIComponent(`🎂 Parabéns, ${name}! Feliz Aniversário! 🎉 Como presente, você tem 10% de desconto no seu próximo corte. Agende já: ${window.location.origin}/agendamentos/${barbershop?.slug}`);
    const clean = phone.replace(/\D/g, "");
    const full = clean.startsWith("55") ? clean : `55${clean}`;
    window.open(`https://wa.me/${full}?text=${msg}`, "_blank");
  };

  const monthName = format(new Date(), "MMMM", { locale: ptBR });

  if (isLoading && queryEnabled && !customers.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Localizando festas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronia</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar a lista de aniversariantes.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight font-display">
          <Cake className="h-8 w-8 text-primary" /> Aniversários
        </h1>
        <p className="text-muted-foreground text-sm mt-1 font-medium capitalize">
          {customers.length} aniversariante{customers.length !== 1 ? "s" : ""} identificado{customers.length !== 1 ? "s" : ""} em {monthName}
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
          <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <Cake className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2 capitalize">Mês tranquilo em {monthName}</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Cadastre as datas de nascimento dos seus clientes para criar promoções automáticas de marketing.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {customers.map((c) => {
            const day = new Date(c.birth_date + "T00:00").getDate();
            const today = new Date().getDate();
            const isToday = day === today;
            return (
              <div key={c.id} className={`group rounded-2xl border transition-all duration-300 p-5 flex items-center gap-5 ${
                isToday ? "bg-primary/10 border-primary/30 shadow-gold scale-[1.02]" : "bg-card border-border hover:border-primary/20"
              }`}>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:rotate-12 ${
                  isToday ? "bg-primary text-primary-foreground shadow-gold" : "bg-background border border-border"
                }`}>🎂</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-foreground truncate">{c.name}</p>
                    {isToday && (
                      <Badge className="bg-primary hover:bg-primary text-[10px] font-black uppercase text-primary-foreground animate-pulse">HOJE!</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground uppercase tracking-tighter">
                    <span className={isToday ? "text-primary" : ""}>Dia {day}</span>
                    {c.phone && (
                      <span className="flex items-center gap-1 opacity-60"><Phone className="h-3 w-3" /> {c.phone}</span>
                    )}
                  </div>
                </div>
                {c.phone && (
                  <Button size="sm" onClick={() => sendWhatsApp(c.phone, c.name)}
                    className={`h-10 rounded-xl px-4 font-bold transition-all ${
                      isToday ? "gold-gradient text-primary-foreground" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20"
                    }`}>
                    <MessageCircle className="h-4 w-4 mr-2" /> Parabenizar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Aniversarios;