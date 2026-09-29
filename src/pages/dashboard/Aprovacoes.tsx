import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, ShieldCheck, Search, Clock, User, Hash } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toBRT } from "@/lib/timezone";
import { toast } from "sonner";
import { formatComanda, parseComandaQuery } from "@/lib/comanda";

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const Aprovacoes = () => {
  const { clinic } = useClinic() as any;
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["comissao-pendente", clinic?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("appointments") as any)
        .select(
          "id, comanda_number, client_name, service_name, price, total_price, barber_name, scheduled_at, commission_approved, commission_pct, commission_amount, status"
        )
        .eq("barbershop_id", clinic.id)
        .eq("status", "completed")
        .or("commission_approved.is.null,commission_approved.eq.false")
        .order("scheduled_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return appointments;
    const num = parseComandaQuery(search);
    const q = search.toLowerCase();
    return appointments.filter(
      (a: any) =>
        (num !== null && a.comanda_number === num) ||
        String(a.client_name || "").toLowerCase().includes(q) ||
        String(a.barber_name || "").toLowerCase().includes(q) ||
        String(a.service_name || "").toLowerCase().includes(q)
    );
  }, [appointments, search]);

  const totals = useMemo(() => {
    let gross = 0, comm = 0;
    filtered.forEach((a: any) => {
      gross += Number(a.total_price ?? a.price ?? 0);
      comm += Number(a.commission_amount ?? 0);
    });
    return { gross, comm, net: gross - comm };
  }, [filtered]);

  const handleApprove = async (id: string) => {
    try {
      setBusyId(id);
      const { error } = await (supabase.rpc as any)("approve_appointment_commission", { _appointment_id: id });
      if (error) {
        if (error.code === "42501" || error.message?.toLowerCase().includes("permission denied")) {
          throw new Error("Permissão negada. Apenas gerentes podem aprovar.");
        }
        throw error;
      }
      toast.success("Comissão liberada. O profissional foi notificado.");
      queryClient.invalidateQueries({ queryKey: ["comissao-pendente"] });
      queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível liberar a comissão");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Aprovação de Comandas
          </h1>
          <p className="text-sm text-muted-foreground">
            Libere a comissão dos profissionais para atendimentos concluídos.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "Bruto", v: totals.gross, c: "text-foreground" },
            { l: "Comissões", v: totals.comm, c: "text-muted-foreground" },
            { l: "Líquido clínica", v: totals.net, c: "text-primary" },
          ].map((k) => (
            <Card key={k.l} className="border-border">
              <CardContent className="p-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground">{k.l}</p>
                <p className={`text-base font-black ${k.c}`}>{brl(k.v)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nº da comanda (CMD-000123), cliente, profissional ou procedimento..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
            <p className="text-sm font-medium">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground">Nenhuma comanda aguardando aprovação.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((appt: any) => {
            const gross = Number(appt.total_price ?? appt.price ?? 0);
            const comm = Number(appt.commission_amount ?? 0);
            return (
              <Card key={appt.id} className="border-border">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[11px] font-mono font-bold text-primary flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {formatComanda(appt.comanda_number)}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <User className="h-3.5 w-3.5 text-primary" />
                      {appt.client_name}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {appt.service_name} • Profissional: {appt.barber_name || "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(toBRT(appt.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs space-y-0.5">
                      <p className="text-muted-foreground">Total <b className="text-foreground">{brl(gross)}</b></p>
                      <p className="text-muted-foreground">
                        Profissional ({Number(appt.commission_pct ?? 0)}%) <b className="text-foreground">{brl(comm)}</b>
                      </p>
                      <p className="text-muted-foreground">Clínica <b className="text-primary">{brl(gross - comm)}</b></p>
                    </div>
                    <Button size="sm" disabled={busyId === appt.id} onClick={() => handleApprove(appt.id)}>
                      {busyId === appt.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      Liberar comissão
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Aprovacoes;
