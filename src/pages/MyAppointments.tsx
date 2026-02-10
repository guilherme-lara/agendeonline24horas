import { useState } from "react";
import { mockAppointments, Appointment } from "@/data/mock-data";
import AppointmentCard from "@/components/AppointmentCard";
import { useToast } from "@/hooks/use-toast";

const MyAppointments = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);

  const upcoming = appointments.filter((a) => a.status === "confirmed");
  const history = appointments.filter((a) => a.status !== "confirmed");

  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");

  const handleCancel = (id: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
    );
    toast({
      title: "Agendamento cancelado",
      description: "Seu agendamento foi cancelado com sucesso.",
    });
  };

  const displayed = tab === "upcoming" ? upcoming : history;

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="font-display text-2xl font-bold mb-6">Meus Agendamentos</h1>

      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-secondary">
        <button
          onClick={() => setTab("upcoming")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
            tab === "upcoming"
              ? "gold-gradient text-primary-foreground shadow-gold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Próximos ({upcoming.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
            tab === "history"
              ? "gold-gradient text-primary-foreground shadow-gold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Histórico ({history.length})
        </button>
      </div>

      {displayed.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum agendamento encontrado.</p>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {displayed.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={tab === "upcoming" ? handleCancel : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
