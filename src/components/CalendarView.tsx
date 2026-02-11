import { useMemo, useState } from "react";
import { format, isSameDay, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: string;
  client_name: string;
  service_name: string;
  scheduled_at: string;
  price: number;
  status: string;
}

interface CalendarViewProps {
  appointments: Appointment[];
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00

const statusConfig: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  pending: { bg: "bg-muted", border: "border-muted-foreground/30", text: "text-muted-foreground" },
  completed: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400" },
  cancelled: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive" },
};

const CalendarView = ({ appointments }: CalendarViewProps) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.scheduled_at), day) && a.status !== "cancelled");

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display text-sm font-semibold">
          {format(days[0], "dd MMM", { locale: ptBR })} — {format(days[6], "dd MMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
            <div className="p-2" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-2 text-center border-l border-border ${
                  isSameDay(day, new Date()) ? "bg-primary/5" : ""
                }`}
              >
                <p className="text-xs text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                <p className={`text-sm font-bold ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>
                  {format(day, "dd")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[52px]">
              <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const dayAppts = getAppointmentsForDay(day).filter((a) => {
                  const h = new Date(a.scheduled_at).getHours();
                  return h === hour;
                });
                return (
                  <div key={day.toISOString()} className="border-l border-border/50 p-0.5 relative">
                    {dayAppts.map((a) => {
                      const cfg = statusConfig[a.status] || statusConfig.pending;
                      return (
                        <div
                          key={a.id}
                          className={`rounded px-1.5 py-1 mb-0.5 border text-[10px] leading-tight truncate ${cfg.bg} ${cfg.border} ${cfg.text}`}
                          title={`${a.client_name} - ${a.service_name}`}
                        >
                          <span className="font-semibold">{format(new Date(a.scheduled_at), "HH:mm")}</span>{" "}
                          {a.client_name.split(" ")[0]}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
