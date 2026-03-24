import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toBRT, nowBRT } from "@/lib/timezone";
import BarberStatementPDF from "@/components/BarberStatementPDF";

const BarberDashboard = () => {
  const { user, signOut } = useAuth();
  const [showStatement, setShowStatement] = useState(false);
  const today = nowBRT();

  // Get barber record
  const { data: barber, isLoading: barberLoading } = useQuery({
    queryKey: ["barber-self", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("barbers") as any)
        .select("*, barbershops:barbershop_id(name, logo_url, slug)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get appointments for this barber
  const { data: appointments = [], isLoading: apptLoading } = useQuery({
    queryKey: ["barber-appointments", barber?.name, barber?.barbershop_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barber.barbershop_id)
        .eq("barber_name", barber.name)
        .gte("scheduled_at", startOfMonth(today).toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!barber?.name && !!barber?.barbershop_id,
  });

  // Get completed orders for financial
  const { data: orders = [] } = useQuery({
    queryKey: ["barber-orders", barber?.name, barber?.barbershop_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("barbershop_id", barber.barbershop_id)
        .eq("barber_name", barber.name)
        .eq("status", "paid")
        .gte("created_at", startOfMonth(today).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!barber?.name && !!barber?.barbershop_id,
  });

  const commissionRate = barber?.commission_pct || 50;

  // Financial calculations
  const stats = useMemo(() => {
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const todayOrders = orders.filter((o: any) => {
      const d = toBRT(o.created_at);
      return d >= todayStart && d <= todayEnd;
    });

    const monthTotal = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const todayTotal = todayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    const pendingAppts = appointments.filter((a: any) =>
      a.status === "confirmed" || a.status === "pending"
    );

    return {
      todayEarnings: todayTotal * (commissionRate / 100),
      monthCommission: monthTotal * (commissionRate / 100),
      pendingCount: pendingAppts.length,
      todayTotal,
      monthTotal,
    };
  }, [orders, appointments, commissionRate, today]);

  // Today's appointments
  const todayAppointments = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    return appointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return format(d, "yyyy-MM-dd") === todayStr && a.status !== "cancelled";
    });
  }, [appointments, today]);

  const handleMarkDone = async (appointmentId: string) => {
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", appointmentId);
  };

  if (barberLoading || apptLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <User className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Conta não vinculada</h1>
          <p className="text-sm text-muted-foreground">Sua conta não está vinculada a nenhuma barbearia. Contate o administrador.</p>
          <Button variant="outline" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">{barber.name}</h1>
          <p className="text-[10px] text-muted-foreground">{(barber as any).barbershops?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowStatement(true)} className="h-8 text-xs">
            <FileText className="h-3.5 w-3.5 mr-1" /> Extrato
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut} className="h-8 text-xs text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto pb-20">
        {/* Financial Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-lg font-black text-foreground">
                R$ {stats.todayEarnings.toFixed(0)}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Ganhos Hoje</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-lg font-black text-foreground">
                R$ {stats.monthCommission.toFixed(0)}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Comissão Mês</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
              <p className="text-lg font-black text-foreground">{stats.pendingCount}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Pendentes</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Comissão: {commissionRate}% sobre vendas finalizadas
        </p>

        {/* Today's Agenda */}
        <div>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Agenda de Hoje — {format(today, "dd/MM", { locale: ptBR })}
          </h2>

          {todayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
          ) : (
            <div className="space-y-2">
              {todayAppointments.map((appt: any) => {
                const time = format(toBRT(appt.scheduled_at), "HH:mm");
                const isDone = appt.status === "completed";
                return (
                  <div key={appt.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${isDone ? "border-green-500/20 bg-green-500/5 opacity-70" : "border-border bg-card"}`}>
                    <div className="text-center min-w-[50px]">
                      <p className="text-sm font-black">{time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appt.client_name}</p>
                      <p className="text-xs text-muted-foreground">{appt.service_name} • R$ {appt.price}</p>
                    </div>
                    {!isDone ? (
                      <Button size="sm" onClick={() => handleMarkDone(appt.id)} className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Realizado
                      </Button>
                    ) : (
                      <span className="text-[10px] font-bold text-green-500">✓ Feito</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {appointments.filter((a: any) => {
          const d = toBRT(a.scheduled_at);
          return d > endOfDay(today) && a.status !== "cancelled";
        }).length > 0 && (
          <div>
            <h2 className="text-sm font-bold mb-3">Próximos Dias</h2>
            <div className="space-y-2">
              {appointments
                .filter((a: any) => toBRT(a.scheduled_at) > endOfDay(today) && a.status !== "cancelled")
                .slice(0, 10)
                .map((appt: any) => (
                  <div key={appt.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
                    <div className="text-center min-w-[70px]">
                      <p className="text-[10px] text-muted-foreground">{format(toBRT(appt.scheduled_at), "dd/MM")}</p>
                      <p className="text-sm font-bold">{format(toBRT(appt.scheduled_at), "HH:mm")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appt.client_name}</p>
                      <p className="text-xs text-muted-foreground">{appt.service_name}</p>
                    </div>
                    <p className="text-xs font-bold">R$ {appt.price}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Statement Modal */}
      {showStatement && (
        <BarberStatementPDF
          barber={barber}
          orders={orders}
          appointments={appointments}
          commissionRate={commissionRate}
          onClose={() => setShowStatement(false)}
        />
      )}
    </div>
  );
};

export default BarberDashboard;
