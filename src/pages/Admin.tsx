import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Users, Crown, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscriber {
  id: string;
  name: string;
  phone: string;
  plan: string;
  plan_price: number;
  status: string;
  start_date: string;
  created_at: string;
}

const planLabel: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  premium: "Premium",
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  active: { text: "Ativo", cls: "text-green-400" },
  inactive: { text: "Inativo", cls: "text-muted-foreground" },
  cancelled: { text: "Cancelado", cls: "text-destructive" },
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) return;
    if (!authLoading && user && isAdmin) {
      supabase
        .from("subscribers")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setSubscribers((data as Subscriber[]) || []);
          setLoading(false);
        });
    }
  }, [user, authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20 text-center animate-fade-in">
        <h2 className="font-display text-2xl font-bold mb-3">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground mb-6">Faça login para acessar o painel administrativo.</p>
        <Button onClick={() => navigate("/login")} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
          Fazer Login
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container max-w-md py-20 text-center animate-fade-in">
        <h2 className="font-display text-2xl font-bold mb-3">Sem Permissão</h2>
        <p className="text-sm text-muted-foreground mb-6">Você não tem permissão de administrador.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar ao Início</Button>
      </div>
    );
  }

  const activeCount = subscribers.filter((s) => s.status === "active").length;
  const revenue = subscribers.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.plan_price), 0);

  const stats = [
    { label: "Assinantes Ativos", value: activeCount, icon: Users, color: "text-primary" },
    { label: "Receita Mensal", value: `R$ ${revenue.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-green-400" },
    { label: "Total Cadastros", value: subscribers.length, icon: Crown, color: "text-primary" },
  ];

  return (
    <div className="container max-w-4xl py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-bold">Painel Administrativo</h1>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <p className="font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display text-lg font-bold mb-4">Assinantes</h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : subscribers.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum assinante cadastrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plano</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => {
                  const st = statusLabel[s.status] || statusLabel.inactive;
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{s.phone}</td>
                      <td className="px-4 py-3">
                        <span className="text-primary font-medium">{planLabel[s.plan] || s.plan}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        R$ {Number(s.plan_price).toFixed(2).replace(".", ",")}
                      </td>
                      <td className={`px-4 py-3 font-medium ${st.cls}`}>{st.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
