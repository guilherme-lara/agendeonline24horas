import { useMemo, useState, useRef, useCallback } from "react";
import { format, isSameDay, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

interface Appointment {
  id: string;
  client_name: string;
  service_name: string;
  scheduled_at: string;
  price: number;
  status: string;
  has_signal?: boolean;
  barber_name?: string;
}

interface CalendarViewProps {
  appointments: Appointment[];
  barbershopId?: string;
  onRefresh?: () => void;
  onEventClick?: (appt: Appointment) => void;
  onSlotClick?: (slot: Date) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

const statusConfig: Record<string, { bg: string; bar: string; text: string; dot: string; pill: string; label: string }> = {
  confirmed:          { bg: "bg-emerald-500/10", bar: "", text: "text-emerald-500", dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-500", label: "Confirmado" },
  pending:            { bg: "bg-amber-500/10", bar: "", text: "text-amber-500", dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-500", label: "Pendente" },
  completed:          { bg: "bg-blue-500/10", bar: "", text: "text-blue-500", dot: "bg-blue-500", pill: "bg-blue-500/10 text-blue-500", label: "Concluído" },
  cancelled:          { bg: "bg-rose-500/10", bar: "", text: "text-rose-500", dot: "bg-rose-500", pill: "bg-rose-500/10 text-rose-500", label: "Cancelado" },
  pending_payment:    { bg: "bg-amber-500/10", bar: "", text: "text-amber-500", dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-500", label: "Aguardando" },
  pendente_pagamento: { bg: "bg-amber-500/10", bar: "", text: "text-amber-500", dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-500", label: "Aguardando" },
};

const LONG_PRESS_DELAY = 400; // ms

const CalendarView = ({ appointments, barbershopId, onRefresh, onEventClick, onSlotClick }: CalendarViewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [draggingApptId, setDraggingApptId] = useState<string | null>(null);

  // Touch drag state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragData = useRef<{ apptId: string; startX: number; startY: number } | null>(null);
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [touchDragPos, setTouchDragPos] = useState<{ x: number; y: number } | null>(null);
  const [touchHighlight, setTouchHighlight] = useState<string | null>(null); // "day-hour" key

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => {
      if (isSameDay(new Date(a.scheduled_at), day) && a.status !== "cancelled") {
        // No Pay No Slot: hide pix_online with pending payment
        const appt = a as any;
        if (appt.payment_method === 'pix_online' && ['pending', 'awaiting'].includes(appt.payment_status)) return false;
        return true;
      }
      return false;
    });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newDateStr }: { id: string; newDateStr: string }) => {
      const { error } = await (supabase.from("appointments") as any)
        .update({ scheduled_at: newDateStr })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, newDateStr }) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      queryClient.setQueryData(["appointments", barbershopId], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((appt: any) => 
          appt.id === id ? { ...appt, scheduled_at: newDateStr } : appt
        );
      });
      setDraggingApptId(null);
    },
    onSuccess: () => {
      toast({ title: "HorÃ¡rio atualizado!", description: "Remarcado com sucesso." });
    },
    onError: () => {
      toast({ title: "Falha na conexÃ£o", description: "NÃ£o foi possÃ­vel remarcar.", variant: "destructive" });
    },
    onSettled: () => {
      if (onRefresh) onRefresh();
    }
  });

  // --- DESKTOP: HTML5 DRAG ---
  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    e.dataTransfer.setData("appt_id", apptId);
    setDraggingApptId(apptId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData("appt_id");
    if (!apptId) return;
    executeDrop(apptId, day, hour);
  };

  // --- SHARED DROP LOGIC ---
  const executeDrop = useCallback((apptId: string, day: Date, hour: number) => {
    const newDate = new Date(day);
    newDate.setHours(hour, 0, 0, 0);

    const draggedAppt = appointments.find(a => a.id === apptId);
    if (draggedAppt && new Date(draggedAppt.scheduled_at).getTime() === newDate.getTime()) {
      setDraggingApptId(null);
      return;
    }

    rescheduleMutation.mutate({ id: apptId, newDateStr: newDate.toISOString() });
  }, [appointments, rescheduleMutation]);

  // --- MOBILE: TOUCH LONG-PRESS DRAG ---
  const handleTouchStart = useCallback((e: React.TouchEvent, apptId: string) => {
    const touch = e.touches[0];
    touchDragData.current = { apptId, startX: touch.clientX, startY: touch.clientY };
    
    longPressTimer.current = setTimeout(() => {
      setDraggingApptId(apptId);
      setTouchDragActive(true);
      setTouchDragPos({ x: touch.clientX, y: touch.clientY });
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DELAY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];

    // Cancel long-press if moved too far before activation
    if (!touchDragActive && touchDragData.current && longPressTimer.current) {
      const dx = Math.abs(touch.clientX - touchDragData.current.startX);
      const dy = Math.abs(touch.clientY - touchDragData.current.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        touchDragData.current = null;
      }
      return;
    }

    if (!touchDragActive) return;

    e.preventDefault(); // Prevent scroll while dragging
    setTouchDragPos({ x: touch.clientX, y: touch.clientY });

    // Hit-test to find which cell we're over
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el?.closest('[data-cell-key]') as HTMLElement | null;
    setTouchHighlight(cell?.getAttribute('data-cell-key') || null);
  }, [touchDragActive]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (touchDragActive && touchDragData.current && touchDragPos) {
      // Find drop target
      const el = document.elementFromPoint(touchDragPos.x, touchDragPos.y);
      const cell = el?.closest('[data-cell-key]') as HTMLElement | null;
      if (cell) {
        const dayIdx = parseInt(cell.getAttribute('data-day-idx') || '0');
        const hour = parseInt(cell.getAttribute('data-hour') || '0');
        const day = days[dayIdx];
        if (day) {
          executeDrop(touchDragData.current.apptId, day, hour);
        }
      }
    }

    setTouchDragActive(false);
    setTouchDragPos(null);
    setTouchHighlight(null);
    setDraggingApptId(null);
    touchDragData.current = null;
  }, [touchDragActive, touchDragPos, days, executeDrop]);

  return (
    <div 
      className="rounded-2xl border border-border bg-sys-surface overflow-hidden shadow-sm relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Touch drag floating indicator */}
      {touchDragActive && touchDragPos && draggingApptId && (
        <div
          className="fixed z-50 pointer-events-none bg-sys-brand-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg"
          style={{ left: touchDragPos.x - 40, top: touchDragPos.y - 30 }}
        >
          Solte para remarcar
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-sys-bg-base">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, -7))} className="h-8 w-8 p-0 hover:bg-sys-brand-primary/10 hover:text-sys-brand-primary rounded-lg">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold uppercase tracking-wide text-sys-text-muted">
          {format(days[0], "dd MMM", { locale: ptBR })} â€” {format(days[6], "dd MMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, 7))} className="h-8 w-8 p-0 hover:bg-sys-brand-primary/10 hover:text-sys-brand-primary rounded-lg">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border bg-sys-surface sticky top-0 z-10">
            <div className="p-2" />
            {days.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`p-2 text-center border-l border-border ${isToday ? "bg-secondary/50" : ""}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sys-text-muted">{format(day, "EEE", { locale: ptBR })}</p>
                  <p className={`text-base font-bold mt-0.5 ${isToday ? "text-foreground" : "text-sys-text-primary"}`}>
                    {format(day, "dd")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border min-h-[56px] group">
                <div className="p-1.5 text-[10px] font-semibold tabular-nums text-sys-text-muted text-right pr-2 pt-1.5">
                  {String(hour).padStart(2, "0")}:00
                </div>

                {days.map((day, dayIdx) => {
                  const dayAppts = getAppointmentsForDay(day).filter((a) => new Date(a.scheduled_at).getHours() === hour);
                  const cellKey = `${dayIdx}-${hour}`;
                  const isHighlighted = touchHighlight === cellKey;

                  return (
                    <div
                      key={day.toISOString()}
                      data-cell-key={cellKey}
                      data-day-idx={dayIdx}
                      data-hour={hour}
                      className={`group/cell border-l border-border p-1 relative min-h-[52px] cursor-pointer transition-colors hover:bg-secondary/50
                        ${isHighlighted ? 'bg-secondary' : ''}
                        data-[is-dragover=true]:bg-secondary`}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => e.currentTarget.setAttribute('data-is-dragover', 'true')}
                      onDragLeave={(e) => e.currentTarget.removeAttribute('data-is-dragover')}
                      onDrop={(e) => {
                        e.currentTarget.removeAttribute('data-is-dragover');
                        handleDrop(e, day, hour);
                      }}
                      onClick={() => {
                        if (touchDragActive || !onSlotClick) return;
                        const slot = new Date(day);
                        slot.setHours(hour, 0, 0, 0);
                        onSlotClick(slot);
                      }}
                    >
                      {dayAppts.length === 0 && onSlotClick && (
                        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[10px] font-medium text-sys-text-muted/80 group-hover/cell:flex">
                          <Plus className="mr-1 h-3 w-3" />
                          Buscar cliente
                        </div>
                      )}
                      {dayAppts.map((a) => {
                        const cfg = statusConfig[a.status] || statusConfig.pending;
                        const isDraggingThis = draggingApptId === a.id;

                        return (
                          <div
                            key={a.id}
                            draggable={!isMobile}
                            onDragStart={(e) => handleDragStart(e, a.id)}
                            onDragEnd={() => setDraggingApptId(null)}
                            onTouchStart={(e) => handleTouchStart(e, a.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!touchDragActive && onEventClick) onEventClick(a);
                            }}
                            className={`group relative rounded-md p-2.5 mb-1 transition-all
                                ${cfg.bg} ${cfg.bar} ${cfg.text}
                                cursor-grab active:cursor-grabbing
                                hover:shadow-sm
                                ${a.status === 'cancelled' ? 'line-through opacity-70' : ''}
                                ${a.status === 'pendente_pagamento' || a.status === 'pending_payment' ? 'animate-pulse' : ''}
                                ${isDraggingThis ? "opacity-30 scale-95" : "opacity-100"}
                                ${isMobile ? 'select-none' : ''}
                              `}
                            title={`${a.client_name} â€” ${a.service_name} â€¢ ${cfg.label}`}
                          >
                            <div className="flex items-center justify-between gap-1 pointer-events-none mb-0.5">
                              <span className="font-medium text-[10px] tabular-nums text-muted-foreground tracking-tight">
                                {format(new Date(a.scheduled_at), "HH:mm")}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide ${cfg.pill}`}>
                                <span className={`h-1 w-1 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </div>
                            <p className="font-medium text-xs truncate leading-tight pointer-events-none text-foreground">{a.client_name}</p>
                            <div className="flex items-center justify-between gap-1 mt-0.5 pointer-events-none">
                              <p className="text-[10px] truncate text-muted-foreground flex-1">{a.service_name}</p>
                              {a.has_signal && <DollarSign className="h-3 w-3 text-sys-status-warning shrink-0" />}
                            </div>
                            {a.barber_name && (
                              <div className="flex items-center gap-1 mt-1 pointer-events-none">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-border text-muted-foreground bg-sys-bg-base font-medium">
                                  {a.barber_name.split(' ')[0]}
                                </Badge>
                              </div>
                            )}
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
    </div>
  );
};

export default CalendarView;


