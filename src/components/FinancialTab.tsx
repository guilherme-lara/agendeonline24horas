import { useState, useEffect } from "react";
import { DollarSign, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Barber {
  id: string;
  name: string;
  commission_pct: number;
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
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("barbers").select("id, name, commission_pct").eq("barbershop_id", barbershopId),
      supabase.from("appointments").select("id, barber_name, price, status, scheduled_at")
        .eq("barbershop_id", barbershopId)
        .eq("status", "completed"),
    ]).then(([barbersRes, apptsRes]) => {
      setBarbers((barbersRes.data as Barber[]) || []);
      setAppointments((apptsRes.data as Appointment[]) || []);
      setLoading(false);
    });
  }, [barbershopId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const now = new Date();
  const monthAppts = appointments.filter((a) => {
    const d = new Date(a.scheduled_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalBruto = monthAppts.reduce((s, a) => s + Number(a.price), 0);

  // Calculate commissions per barber
  const commissionData = barbers.map((b) => {
    const barberAppts = monthAppts.filter((a) => a.barber_name === b.name);
    const barberRevenue = barberAppts.reduce((s, a) => s + Number(a.price), 0);
    const commission = barberRevenue * (b.commission_pct / 100);
    return { ...b, revenue: barberRevenue, commission, count: barberAppts.length };
  }).filter((b) => b.count > 0);

  const totalComissoes = commissionData.reduce((s, b) => s + b.commission, 0);
  const lucroLiquido = totalBruto - totalComissoes;

  const stats = [
    { label: "Total Bruto", value: totalBruto, icon: DollarSign, color: "text-primary" },
    { label: "Comissões", value: totalComissoes, icon: TrendingDown, color: "text-yellow-400" },
    { label: "Lucro Líquido", value: lucroLiquido, icon: TrendingUp, color: "text-green-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Financeiro</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {format(now, "MMMM yyyy", { locale: ptBR })}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4 text-center">
            <stat.icon className={`h-5 w-5 ${stat.color} mx-auto mb-2`} />
            <p className="font-display text-lg font-bold">
              R$ {stat.value.toFixed(2).replace(".", ",")}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {commissionData.length > 0 ? (
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
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.count}</td>
                  <td className="px-4 py-3 text-muted-foreground">R$ {b.revenue.toFixed(2).replace(".", ",")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.commission_pct}%</td>
                  <td className="px-4 py-3 font-medium text-yellow-400">R$ {b.commission.toFixed(2).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum atendimento concluído vinculado a barbeiros este mês.
        </p>
      )}
    </div>
  );
};

export default FinancialTab;
