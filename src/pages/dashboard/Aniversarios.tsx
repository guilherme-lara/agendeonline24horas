import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, Cake, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Customer {
  id: string;
  name: string;
  phone: string;
  birth_date: string;
}

const Aniversarios = () => {
  const { barbershop } = useBarbershop();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop) return;
    const currentMonth = new Date().getMonth() + 1;
    supabase
      .from("customers")
      .select("id, name, phone, birth_date")
      .eq("barbershop_id", barbershop.id)
      .not("birth_date", "is", null)
      .then(({ data }) => {
        const birthdayThisMonth = ((data as Customer[]) || []).filter((c) => {
          if (!c.birth_date) return false;
          const month = new Date(c.birth_date + "T00:00").getMonth() + 1;
          return month === currentMonth;
        });
        birthdayThisMonth.sort((a, b) => {
          const dayA = new Date(a.birth_date + "T00:00").getDate();
          const dayB = new Date(b.birth_date + "T00:00").getDate();
          return dayA - dayB;
        });
        setCustomers(birthdayThisMonth);
        setLoading(false);
      });
  }, [barbershop]);

  const sendWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(
      `🎂 Parabéns, ${name}! Feliz Aniversário! 🎉 Como presente, você tem 10% de desconto no seu próximo corte. Agende já: ${window.location.origin}/agendamentos/${barbershop?.slug}`
    );
    const clean = phone.replace(/\D/g, "");
    const full = clean.startsWith("55") ? clean : `55${clean}`;
    window.open(`https://wa.me/${full}?text=${msg}`, "_blank");
  };

  const monthName = format(new Date(), "MMMM", { locale: ptBR });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Cake className="h-6 w-6 text-primary" /> Aniversários
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {customers.length} aniversariante{customers.length !== 1 ? "s" : ""} em {monthName}
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16">
          <Cake className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1 capitalize">Sem aniversariantes em {monthName}</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre clientes com data de nascimento para ativar esta funcionalidade de marketing.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {customers.map((c) => {
            const day = new Date(c.birth_date + "T00:00").getDate();
            const today = new Date().getDate();
            const isToday = day === today;
            return (
              <div
                key={c.id}
                className={`rounded-xl border bg-card p-4 flex items-center gap-4 ${
                  isToday ? "border-primary shadow-gold" : "border-border"
                }`}
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                  isToday ? "gold-gradient" : "bg-secondary"
                } `}>
                  🎂
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{c.name}</p>
                    {isToday && <span className="text-xs text-primary font-bold">HOJE!</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Dia {day}</span>
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  </div>
                </div>
                {c.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendWhatsApp(c.phone, c.name)}
                    className="flex-shrink-0 border-green-500/40 text-green-500 hover:bg-green-500/10"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    Parabenizar
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
