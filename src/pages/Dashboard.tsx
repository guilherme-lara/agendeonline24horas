import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Loader2, TrendingUp, Clock, Users,
  AlertTriangle, Building2, Bell, RefreshCw, Scissors, Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { format, subDays, parseISO, startOfMonth, endOfMonth, isSameDay, addHours } from "date-fns"; // Adicionado addHours
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import UpgradeModal from "@/components/UpgradeModal";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { barbershop, loading: shopLoading, clearImpersonation } = useBarbershop() as any;
  const { toast } = useToast();
  
  const [upgradeModal, setUpgradeModal] = useState({ open: false, plan: "", feature: "" });
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");

  // --- FUNÇÃO AUXILIAR PARA CORREÇÃO DE FUSO ---
  // Adiciona 3 horas (ou remove dependendo do sentido) para alinhar UTC com Local se necessário
  // Ou simplesmente garante que a comparação ignore o erro de fim de dia.
  const toLocalTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    // Se o banco é UTC e você está no Brasil, o banco está 3h à frente.
    // Para compensar vendas feitas às 23h UTC que são 20h Local:
    return addHours(date, -3); 
  };

  // --- SISTEMA 100% LIVE ---
  useEffect(() => {
    if (!barbershop?.id) return;

    const channel = supabase
      .channel('live-dashboard')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'appointments', 
          filter: `barbershop_id=eq.${barbershop.id}` 
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders', 
          filter: `barbershop_id=eq.${barbershop.id}` 
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershop?.id, queryClient]);

  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
    queryKey: ["dashboard-appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, scheduled_at, status")
        .eq("barbershop_id", barbershop.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
    staleTime: 0, // Garante que o dashboard sempre busque dados novos no refetch
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["dashboard-orders", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, items, payment_method, status")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "closed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
    staleTime: 0,
  });

  // Logica de KPI com correção de Data
  const kpis = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);
    
    const activeAppts = appointments.filter((a: any) => a.status !== "cancelled");
    
    // Filtro de agendamentos de hoje (corrigido)
    const todayAppts = activeAppts.filter((a: any) => isSameDay(toLocalTime(a.scheduled_at), today));

    let todayRevServices = 0;
    let todayRevProducts = 0;
    let monthRevTotal = 0;

    orders.forEach((order: any) => {
      const orderDate = toLocalTime(order.created_at); // Aplicando correção aqui
      
      if (orderDate >= startOfCurrentMonth && orderDate <= endOfCurrentMonth) {
        monthRevTotal += Number(order.total);
      }
      
      if (isSameDay(orderDate, today)) {
        (order.items || []).forEach((item: any) => {
          const itemTotal = Number(item.price) * Number(item.qty);
          if (item.type === "product") todayRevProducts += itemTotal;
          else todayRevServices += itemTotal;
        });
      }
    });

    const todayRevTotal = todayRevServices + todayRevProducts;

    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const thisDay = subDays(today, 6 - i);
      let dayServs = 0;
      let dayProds = 0;
      orders.forEach((order: any) => {
        if (isSameDay(toLocalTime(order.created_at), thisDay)) {
          (order.items || []).forEach((item: any) => {
            const itemTotal = Number(item.price) * Number(item.qty);
            if (item.type === "product") dayProds += itemTotal;
            else dayServs += itemTotal;
          });
        }
      });
      return { day: format(thisDay, "EEE", { locale: ptBR }).toUpperCase(), "Serviços": dayServs, "Produtos": dayProds };
    });

    const productSales: Record<string, number> = {};
    orders.filter((o: any) => toLocalTime(o.created_at) >= startOfCurrentMonth).forEach((order: any) => {
      (order.items || []).forEach((item: any) => {
        if (item.type === "product") {
          productSales[item.name] = (productSales[item.name] || 0) + Number(item.qty);
        }
      });
    });
    
    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty }));

    const closedOrdersToday = orders.filter((o: any) => isSameDay(toLocalTime(o.created_at), today));
    const ticketMedio = closedOrdersToday.length > 0 ? todayRevTotal / closedOrdersToday.length : 0;

    const lastTransactions = orders.slice(0, 10).map((o: any) => {
      const items = (o.items || []) as any[];
      const serviceName = items.map((i: any) => i.name).join(", ") || "Venda";
      return { id: o.id, name: serviceName, total: Number(o.total), time: format(toLocalTime(o.created_at), "dd/MM HH:mm"), method: o.payment_method };
    });

    return { todayRevTotal, todayRevServices, todayRevProducts, monthRevTotal, todayCount: todayAppts.length, totalActive: activeAppts.length, chartData, topProducts, ticketMedio, lastTransactions };
  }, [appointments, orders]);

  // ... resto do seu componente (o return permanece igual)
