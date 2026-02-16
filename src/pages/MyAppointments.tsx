import { useState } from "react";
import { Phone, Search, Loader2, Calendar, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface AppointmentResult {
  id: string;
  service_name: string;
  barber_name: string | null;
  scheduled_at: string;
  status: string | null;
  price: number;
  payment_method: string | null;
}

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

const MyAppointments = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentResult[]>([]);

  const handleSearch = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from("appointments")
      .select("id, service_name, barber_name, scheduled_at, status, price, payment_method")
      .eq("client_phone", phone.trim())
      .order("scheduled_at", { ascending: false })
      .limit(50);

    setAppointments((data as AppointmentResult[]) || []);
    setLoading(false);
  };

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= now && a.status !== "cancelled");
  const past = appointments.filter((a) => new Date(a.scheduled_at) < now || a.status === "cancelled");

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
          onClick={handleSearch}
          disabled={loading || phone.replace(/\D/g, "").length < 10}
          className="gold-gradient text-primary-foreground font-semibold hover:opacity-90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {searched && !loading && appointments.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          Nenhum agendamento encontrado para este número.
        </p>
      )}

      {!loading && appointments.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-primary mb-3">Próximos</h2>
              <div className="space-y-2">
                {upcoming.map((a) => {
                  const st = statusMap[a.status || "pending"];
                  return (
                    <div key={a.id} className="rounded-lg border border-border bg-card p-4">
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
                      <p className="text-xs text-primary font-bold mt-2">R$ {Number(a.price).toFixed(2).replace(".", ",")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Histórico</h2>
              <div className="space-y-2">
                {past.map((a) => {
                  const st = statusMap[a.status || "pending"];
                  return (
                    <div key={a.id} className="rounded-lg border border-border bg-card/50 p-4 opacity-80">
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
