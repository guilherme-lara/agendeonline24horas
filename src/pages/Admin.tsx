import { DollarSign, Scissors, Users, Calendar } from "lucide-react";
import { mockAppointments, barbers } from "@/data/mock-data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const todayStr = format(new Date(), "yyyy-MM-dd");

const Admin = () => {
  const todayAppointments = mockAppointments.filter((a) => a.status === "confirmed");
  const completedToday = mockAppointments.filter((a) => a.status === "completed");
  const revenue = completedToday.reduce((sum, a) => sum + a.totalPrice, 0);

  const stats = [
    { label: "Agendamentos Hoje", value: todayAppointments.length, icon: Calendar, color: "text-primary" },
    { label: "Cortes Realizados", value: completedToday.length, icon: Scissors, color: "text-green-400" },
    { label: "Faturamento", value: `R$ ${revenue}`, icon: DollarSign, color: "text-primary" },
    { label: "Profissionais Ativos", value: barbers.length, icon: Users, color: "text-blue-400" },
  ];

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="font-display text-2xl font-bold mb-1">Painel Administrativo</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4 animate-fade-in">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <p className="font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display text-lg font-bold mb-4">Agenda do Dia</h2>
      {todayAppointments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum agendamento para hoje.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Horário</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Serviço</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Profissional</th>
              </tr>
            </thead>
            <tbody>
              {todayAppointments.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-primary">{a.time}</td>
                  <td className="px-4 py-3">Cliente #{a.id}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{a.services.map(s => s.name).join(", ")}</td>
                  <td className="px-4 py-3">{a.barber.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Admin;
