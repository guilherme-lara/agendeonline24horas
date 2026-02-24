import { useState, useEffect, useCallback } from "react";
import { Phone, Search, Loader2, Calendar, Clock, User, CalendarX2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AppointmentResult {
  id: string;
  service_name: string;
  barber_name: string | null;
  scheduled_at: string;
  status: string | null;
  price: number;
  payment_method: string | null;
}

const STORAGE_KEY = "techbarber_client_phone";
const LOYALTY_GOAL = 10;

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const SkeletonCard = () => (
  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3 shadow-sm">
    <div className="flex justify-between">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
    <div className="flex gap-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const AppointmentCard = ({ a, dimmed }: { a: AppointmentResult; dimmed?: boolean }) => {
  const st = statusMap[a.status || "pending"];
  return (
    <div className={`rounded-xl border border-border/50 bg-card p-4 shadow-sm backdrop-blur-sm ${dimmed ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">{a.service_name}</p>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(a.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(a.scheduled_at), "HH:mm")}
        </span>
        {a.barber_name && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {a.barber_name}
          </span>
        )}
      </div>
      {!dimmed && (
        <p className="text-xs text-primary font-bold mt-2">R$ {Number(a.price).toFixed(2).replace(".", ",")}</p>
      )}
    </div>
  );
};

const MyAppointments = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentResult[]>([]);

  const handleSearch = useCallback(async (phoneValue?: string) => {
    const searchPhone = phoneValue || phone;
    const digits = searchPhone.replace(/\D/g, "");
    if (digits.length < 10) return;
    setLoading(true);
    setSearched(true);

    try { localStorage.setItem(STORAGE_KEY, searchPhone.trim()); } catch {}

    const { data } = await supabase
      .from("appointments")
      .select("id, service_name, barber_name, scheduled_at, status, price, payment_method")
      .eq("client_phone", searchPhone.trim())
      .order("scheduled_at", { ascending: false })
      .limit(50);

    setAppointments((data as AppointmentResult[]) || []);
    setLoading(false);
  }, [phone]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.replace(/\D/g, "").length >= 10) {
        setPhone(saved);
        handleSearch(saved);
      }
    } catch {}
  }, []);

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= now && a.status !== "cancelled");
  const past = appointments.filter((a) => new Date(a.scheduled_at) < now || a.status === "cancelled");

  // Loyalty card
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const loyaltyProgress = Math.min(completedCount, LOYALTY_GOAL);
  const loyaltyPercent = (loyaltyProgress / LOYALTY_GOAL) * 100;
  const hasEarnedReward = completedCount >= LOYALTY_GOAL;

  return (
    <div className="container max-w-lg py-8">
      <h1 className="font-display text-2xl font-bold mb-2">Meus Agendamentos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Informe seu celular para consultar seus agendamentos
      </p>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            className="pl-9 bg-card border-border"
            maxLength={15}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          onClick={() => handleSearch()}
          disabled={loading || phone.replace(/\D/g, "").length < 10}
          className="gold-gradient text-primary-foreground font-semibold hover:opacity-90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {loading && (
        <div className="space-y-3 animate-fade-in">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {searched && !loading && appointments.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <CalendarX2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold mb-1">Nenhum agendamento</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Não encontramos agendamentos para este número.
          </p>
          <p className="text-xs text-muted-foreground">
            Verifique se o número está correto ou agende seu primeiro horário!
          </p>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {/* Loyalty Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-5 w-5 text-primary" />
              <h2 className="font-display text-sm font-bold">Cartão Fidelidade</h2>
            </div>
            <Progress value={loyaltyPercent} className="h-3 mb-2" />
            <p className="text-xs text-muted-foreground">
              {hasEarnedReward ? (
                <span className="text-primary font-bold">🎉 Parabéns! Você ganhou um brinde! Avise na barbearia.</span>
              ) : (
                <>{loyaltyProgress} de {LOYALTY_GOAL} cortes — falta{LOYALTY_GOAL - loyaltyProgress > 1 ? "m" : ""} {LOYALTY_GOAL - loyaltyProgress}!</>
              )}
            </p>
          </div>

          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-primary mb-3">Próximos ({upcoming.length})</h2>
              <div className="space-y-2">
                {upcoming.map((a) => <AppointmentCard key={a.id} a={a} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Histórico ({past.length})</h2>
              <div className="space-y-2">
                {past.map((a) => <AppointmentCard key={a.id} a={a} dimmed />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
