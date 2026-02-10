import { Calendar, Clock, User, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment } from "@/data/mock-data";
import { Button } from "@/components/ui/button";

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
}

const statusStyles: Record<string, string> = {
  confirmed: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const AppointmentCard = ({ appointment, onCancel }: AppointmentCardProps) => {
  const dateObj = parseISO(appointment.date);

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-all hover:shadow-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={appointment.barber.avatar}
            alt={appointment.barber.name}
            className="h-10 w-10 rounded-full object-cover border border-border"
          />
          <div>
            <p className="font-semibold text-sm text-foreground">{appointment.barber.name}</p>
            <p className="text-xs text-muted-foreground">{appointment.barber.specialty}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[appointment.status]}`}>
          {statusLabels[appointment.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(dateObj, "dd MMM yyyy", { locale: ptBR })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {appointment.time}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {appointment.services.map((s) => (
          <span key={s.id} className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-md">
            {s.name}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-primary">R$ {appointment.totalPrice}</span>
        {appointment.status === "confirmed" && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(appointment.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
          >
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
