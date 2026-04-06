import { useMemo, useState, useRef, useCallback } from "react";
import { format, isSameDay, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
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
  onEventClick?: (appt: any) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

const statusConfig: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  pending: { bg: "bg-muted", border: "border-muted-foreground/30", text: "text-muted-foreground" },
  completed: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400" },
  cancelled: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive" },
  pending_payment: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400" },
  pendente_pagamento: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400" },
};

const LONG_PRESS_DELAY = 400; // ms

const CalendarView = ({ appointments, barbershopId, onRefresh, onEventClick }: CalendarViewProps) => {
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
      toast({ title: "Horário atualizado!", description: "Remarcado com sucesso." });
    },
    onError: () => {
      toast({ title: "Falha na conexão", description: "Não foi possível remarcar.", variant: "destructive" });
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
      className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Touch drag floating indicator */}
      {touchDragActive && touchDragPos && draggingApptId && (
        <div 
          className="fixed z-50 pointer-events-none bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl"
          style={{ left: touchDragPos.x - 40, top: touchDragPos.y - 30 }}
        >
          Solte para remarcar
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, -7))} className="hover:bg-primary/20 hover:text-primary rounded-xl">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-display text-sm font-black tracking-widest uppercase text-muted-foreground">
          {format(days[0], "dd MMM", { locale: ptBR })} — {format(days[6], "dd MMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, 7))} className="hover:bg-primary/20 hover:text-primary rounded-xl">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card">
            <div className="p-2" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-3 text-center border-l border-border ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                <p className={`text-lg font-black mt-1 ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"}`}>
                  {format(day, "dd")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[60px] group">
                <div className="p-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-3 pt-2">
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
                      className={`border-l border-border/50 p-1 relative transition-colors hover:bg-primary/5 
                        ${isHighlighted ? 'bg-primary/20' : ''}
                        data-[is-dragover=true]:bg-primary/20`}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => e.currentTarget.setAttribute('data-is-dragover', 'true')}
                      onDragLeave={(e) => e.currentTarget.removeAttribute('data-is-dragover')}
                      onDrop={(e) => {
                        e.currentTarget.removeAttribute('data-is-dragover');
                        handleDrop(e, day, hour);
                      }}
                    >
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
                            onClick={() => !touchDragActive && onEventClick && onEventClick(a)}
                            className={`rounded-lg px-2 py-1.5 mb-1 border shadow-sm transition-all
                              ${cfg.bg} ${cfg.border} ${cfg.text} 
                              cursor-grab active:cursor-grabbing
                              hover:brightness-110 hover:scale-[1.02]
                              ${isDraggingThis ? "opacity-30 scale-95 border-dashed" : "opacity-100"}
                              ${isMobile ? 'select-none' : ''}
                            `}
                            title={`${a.client_name} - ${a.service_name}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5 pointer-events-none">
                              <span className="font-black text-[9px] tracking-widest uppercase bg-background/50 px-1 rounded-sm">
                                {format(new Date(a.scheduled_at), "HH:mm")}
                              </span>
                            </div>
                            <p className="font-bold text-xs truncate leading-tight pointer-events-none">{a.client_name}</p>
                            <p className="text-[9px] font-medium truncate opacity-80 pointer-events-none">{a.service_name}</p>
                            <div className="flex flex-wrap items-center gap-1 mt-1 pointer-events-none">
                               {a.barber_name && <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 border-foreground/10 text-foreground/60">{a.barber_name.split(' ')[0]}</Badge>}
                               {a.has_signal && <Badge className="bg-amber-500 text-white text-[8px] px-1 py-0 h-4 border-none flex items-center gap-0.5"><DollarSign className="h-2 w-2"/> Sinal</Badge>}
                            </div>
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
