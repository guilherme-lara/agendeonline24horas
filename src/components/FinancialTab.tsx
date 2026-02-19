import { useState, useEffect, useMemo } from "react";
import { DollarSign, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

type DateFilter = "today" | "week" | "month" | "custom";

interface Barber {
  id: string;
  name: string;
  commission_pct: number;
  avatar_url?: string;
}

interface Appointment {
  id: string;
  barber_name: string;
  price: number;
  status: string;
  scheduled_at: string;
}

interface FinancialTabProps {
  barbershopId: string;
}

const FinancialTab = ({ barbershopId }: FinancialTabProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchData = async () => {
    const [barbersRes, apptsRes] = await Promise.all([
      supabase.from("barbers").select("id, name, commission_pct, avatar_url").eq("barbershop_id", barbershopId),
      supabase.from("appointments").select("id, barber_name, price, status, scheduled_at")
        .eq("barbershop_id", barbershopId)
        .eq("status", "completed"),
    ]);
    setBarbers((barbersRes.data as Barber[]) || []);
    setAppointments((apptsRes.data as Appointment[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [barbershopId]);

  // Realtime: listen for appointment status changes
  useEffect(() => {
    const channel = supabase
      .channel("financial-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        () => {
          fetchData();
          toast({ title: "Atualização", description: "Dados financeiros atualizados em tempo real." });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershopId]);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
      case "month":
        return { start: startOfMonth(now), end: endOfDay(now) };
      case "custom":
        return {
          start: customStart ? new Date(customStart) : startOfMonth(now),
          end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
        };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredAppts = useMemo(() =>
    appointments.filter((a) => {
      const d = new Date(a.scheduled_at);
      return d >= dateRange.start && d <= dateRange.end;
    }),
    [appointments, dateRange]
  );

  const totalBruto = filteredAppts.reduce((s, a) => s + Number(a.price), 0);

  const commissionData = useMemo(() =>
    barbers.map((b) => {
      const barberAppts = filteredAppts.filter((a) => a.barber_name === b.name);
      const barberRevenue = barberAppts.reduce((s, a) => s + Number(a.price), 0);
      const commission = barberRevenue * (b.commission_pct / 100);
      return { ...b, revenue: barberRevenue, commission, count: barberAppts.length };
    }).filter((b) => b.count > 0),
    [barbers, filteredAppts]
  );

  const totalComissoes = commissionData.reduce((s, b) => s + b.commission, 0);
  const lucroLiquido = totalBruto - totalComissoes;

  const filterOptions: { key: DateFilter; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mês" },
    { key: "custom", label: "Período" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { label: "Faturamento", value: totalBruto, icon: DollarSign, color: "text-primary" },
    { label: "Comissões", value: totalComissoes, icon: TrendingDown, color: "text-yellow-400" },
    { label: "Lucro Líquido", value: lucroLiquido, icon: TrendingUp, color: "text-green-400" },
  ];

  const fmtMoney = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Financeiro</h2>
      </div>

      {/* Date filter pills */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary flex-wrap">
        {filterOptions.map((f) => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            className={`flex-1 min-w-[60px] py-2 rounded-md text-xs font-medium transition-all ${
              dateFilter === f.key
                ? "gold-gradient text-primary-foreground shadow-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {dateFilter === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">De</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Até</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-3 sm:p-4 text-center">
            <stat.icon className={`h-5 w-5 ${stat.color} mx-auto mb-2`} />
            <p className="font-display text-sm sm:text-lg font-bold truncate">
              {fmtMoney(stat.value)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Barber details - responsive */}
      {commissionData.length > 0 ? (
        isMobile ? (
          /* Mobile: Cards */
          <div className="space-y-3">
            {commissionData.map((b) => (
              <div key={b.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-9 w-9">
                    {b.avatar_url ? <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" /> : null}
                    <AvatarFallback className="bg-secondary text-xs font-bold">
                      {b.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.count} atendimento{b.count > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Faturado</p>
                    <p className="text-xs font-bold">{fmtMoney(b.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Taxa</p>
                    <p className="text-xs font-bold">{b.commission_pct}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Comissão</p>
                    <p className="text-xs font-bold text-yellow-400">{fmtMoney(b.commission)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table */
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Barbeiro</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Atendimentos</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Faturado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">% Com.</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {commissionData.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {b.avatar_url ? <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" /> : null}
                          <AvatarFallback className="bg-secondary text-[10px] font-bold">
                            {b.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.count}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtMoney(b.revenue)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.commission_pct}%</td>
                    <td className="px-4 py-3 font-medium text-yellow-400">{fmtMoney(b.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="text-center py-8">
          <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum atendimento concluído no período selecionado.
          </p>
        </div>
      )}
    </div>
  );
};

export default FinancialTab;
