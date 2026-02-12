import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Users, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import UpgradeModal from "@/components/UpgradeModal";

interface Barber {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
}

const PLAN_LIMITS: Record<string, number> = {
  essential: 2,
  growth: 5,
  pro: Infinity,
};

interface TeamTabProps {
  barbershopId: string;
  planName: string;
}

const TeamTab = ({ barbershopId, planName }: TeamTabProps) => {
  const { toast } = useToast();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const limit = PLAN_LIMITS[planName] ?? 2;

  const fetchBarbers = async () => {
    const { data } = await supabase
      .from("barbers")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("created_at");
    setBarbers((data as Barber[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBarbers();
  }, [barbershopId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const activeCount = barbers.filter((b) => b.active).length;
    if (activeCount >= limit) {
      setUpgradeOpen(true);
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("barbers").insert({
      barbershop_id: barbershopId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Barbeiro adicionado!" });
      setName("");
      setPhone("");
      setEmail("");
      fetchBarbers();
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("barbers").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Barbeiro removido" });
      setBarbers((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const activeCount = barbers.filter((b) => b.active).length;

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredPlan={planName === "essential" ? "Growth" : "Pro"}
        featureName={`Mais de ${limit} barbeiros`}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Equipe</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {activeCount}/{limit === Infinity ? "∞" : limit} barbeiros
        </span>
      </div>

      {/* Add form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-medium">Adicionar Barbeiro</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do barbeiro"
          className="bg-secondary border-border"
          maxLength={100}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone (opcional)"
            className="bg-secondary border-border"
            maxLength={20}
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail (opcional)"
            className="bg-secondary border-border"
            maxLength={100}
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={adding || !name.trim()}
          className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Adicionar
          {activeCount >= limit && <Crown className="h-3 w-3 ml-2" />}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : barbers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum barbeiro cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {barbers.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <p className="font-medium text-sm">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.phone || b.email || "Sem contato"}
                </p>
              </div>
              <button onClick={() => handleRemove(b.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamTab;
