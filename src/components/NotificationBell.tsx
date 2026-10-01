import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const playBeep = () => {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* ignore */
  }
};

const NotificationBell = ({ className }: { className?: string }) => {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const key = ["notifications", user?.id];

  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase.from("notifications") as any)
        .select("id, type, title, body, link, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          playBeep();
          toast(n.title, { description: n.body ?? undefined });
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          if (n.type === "commission_pending") queryClient.invalidateQueries({ queryKey: ["comissao-pendente"] });
          if (n.type === "commission_approved") queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    await (supabase.from("notifications") as any)
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    queryClient.invalidateQueries({ queryKey: key });
  };

  const open = (n: Notification) => {
    if (!n.read_at) markRead([n.id]);
    if (n.link) navigate(n.link === "/profissional" ? "/pdv" : n.link);
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-9 w-9", className)} aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-bold">Notificações</p>
          {unread > 0 && (
            <button
              onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-secondary transition-colors flex gap-3",
                  !n.read_at && "bg-primary/5"
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", n.read_at ? "bg-transparent" : "bg-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="block text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
