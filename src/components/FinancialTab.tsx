import { useState, useEffect, useMemo } from "react";
import { DollarSign, Download, Loader2, TrendingDown, TrendingUp, Wallet, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { toBRT } from "@/lib/timezone";
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

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
}

interface FinancialTabProps {
  barbershopId: string;
}

const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const BOM = "\uFEFF";
  const csv = BOM + [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const FinancialTab = ({ barbershopId }: FinancialTabProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchData = async () => {
    const [barbersRes, apptsRes, expRes, ordRes] = await Promise.all([
      (supabase.from("barbers") as any).select("id, name, commission_pct, avatar_url").eq("barbershop_id", barbershopId),
      (supabase.from("appointments") as any).select("id, barber_name, price, status, scheduled_at")
        .eq("barbershop_id", barbershopId)
        .eq("status", "completed"),
      (supabase.from("expenses") as any).select("id, amount, description, date, category")
        .eq("barbershop_id", barbershopId),
      (supabase.from("orders") as any).select("id, total, status, created_at")
        .eq("barbershop_id", barbershopId)
        .eq("status", "closed"),
    ]);
    setBarbers((barbersRes.data as Barber[]) || []);
    setAppointments((apptsRes.data as Appointment[]) || []);
    setExpenses((expRes.data as Expense[]) || []);
    setOrders((ordRes.data as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [barbershopId]);

  useEffect(() => {
    const channel = supabase
      .channel("financial-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `barbershop_id=eq.${barbershopId}` }, () => {
        fetchData();
        toast({ title: "Atualização", description: "Dados financeiros atualizados em tempo real." });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barbershopId]);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
      case "month": return { start: startOfMonth(now), end: endOfDay(now) };
      case "custom": return {
        start: customStart ? new Date(customStart) : startOfMonth(now),
        end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
      };
    }
  }, [dateFilter, customStart, customEnd]);

  const filteredAppts = useMemo(() =>
    appointments.filter((a) => {
      const d = toBRT(a.scheduled_at);
      return d >= dateRange.start && d <= dateRange.end;
    }), [appointments, dateRange]);

  const filteredExpenses = useMemo(() =>
    expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= dateRange.start && d <= dateRange.end;
    }), [expenses, dateRange]);

  const filteredOrders = useMemo(() =>
    orders.filter((o) => {
      const d = toBRT(o.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    }), [orders, dateRange]);

  const apptRevenue = filteredAppts.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const orderRevenue = filteredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalBruto = apptRevenue + orderRevenue;
  const totalDespesas = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const commissionData = useMemo(() =>
    barbers.map((b) => {
      const barberAppts = filteredAppts.filter((a) => a.barber_name === b.name);
      const barberRevenue = barberAppts.reduce((s, a) => s + (Number(a.price) || 0), 0);
      const commission = barberRevenue * ((b.commission_pct || 0) / 100);
      return { ...b, revenue: barberRevenue, commission, count: barberAppts.length };
    }).filter((b) => b.count > 0), [barbers, filteredAppts]);

  const totalComissoes = commissionData.reduce((s, b) => s + b.commission, 0);
  const lucroLiquido = totalBruto - totalComissoes - totalDespesas;

  const filterOptions: { key: DateFilter; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mês" },
    { key: "custom", label: "Período" },
  ];

  const handleExportCSV = () => {
    const rows = commissionData.map((b) => ({
      Barbeiro: b.name,
      Atendimentos: b.count,
      "Faturado (R$)": b.revenue.toFixed(2),
      "Comissão (%)": b.commission_pct,
      "Comissão (R$)": b.commission.toFixed(2),
    }));
    rows.push({
      Barbeiro: "TOTAIS",
      Atendimentos: filteredAppts.length,
      "Faturado (R$)": totalBruto.toFixed(2),
      "Comissão (%)": 0,
      "Comissão (R$)": totalComissoes.toFixed(2),
    } as any);
    exportToCSV(rows, `relatorio-financeiro-${format(new Date(), "yyyy-MM-dd")}.csv`);
    toast({ title: "CSV exportado!", description: "Arquivo baixado com sucesso." });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const fmtMoney = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const stats = [
    { label: "Receita Bruta", value: totalBruto, icon: DollarSign, color: "text-primary" },
    { label: "Comissões", value: totalComissoes, icon: TrendingDown, color: "text-yellow-400" },
    { label: "Despesas", value: totalDespesas, icon: Receipt, color: "text-red-400" },
    { label: "Lucro Líquido", value: lucroLiquido, icon: TrendingUp, color: lucroLiquido >= 0 ? "text-green-400" : "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Financeiro</h2>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar (.csv)
        </Button>
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
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Até</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      {/* KPI Cards - 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/50 bg-card p-3 sm:p-4 text-center backdrop-blur-sm shadow-sm">
            <stat.icon className={`h-5 w-5 ${stat.color} mx-auto mb-2`} />
            <p className="font-display text-sm sm:text-lg font-bold truncate">
              {fmtMoney(stat.value)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Barber details */}
      {commissionData.length > 0 ? (
        isMobile ? (
          <div className="space-y-3">
            {commissionData.map((b) => (
              <div key={b.id} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm backdrop-blur-sm">
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
          <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm backdrop-blur-sm">
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
