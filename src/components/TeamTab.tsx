import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Users, Crown, Upload, Archive, ArchiveRestore } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import UpgradeModal from "@/components/UpgradeModal";

interface Barber {
  id: string;
  name: string;
  phone: string;
  email: string;
  commission_pct: number;
  active: boolean;
  avatar_url?: string;
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
  const [commission, setCommission] = useState("30");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const limit = PLAN_LIMITS[planName] ?? 2;

  const fetchBarbers = async () => {
    const { data } = await (supabase
      .from("barbers") as any)
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("created_at");
    setBarbers((data as Barber[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBarbers(); }, [barbershopId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const activeCount = barbers.filter((b) => b.active).length;
    if (activeCount >= limit) {
      setUpgradeOpen(true);
      return;
    }
    setAdding(true);
    const { error } = await (supabase.from("barbers") as any).insert({
      barbershop_id: barbershopId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      commission_pct: parseFloat(commission) || 0,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Barbeiro adicionado!" });
      setName(""); setPhone(""); setEmail(""); setCommission("30");
      fetchBarbers();
    }
    setAdding(false);
  };

  const handleArchive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("barbers")
      .update({ active: !currentActive })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentActive ? "Barbeiro arquivado" : "Barbeiro reativado" });
      fetchBarbers();
    }
  };

  const handlePhotoUpload = async (barberId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const filePath = `barbers/${barberId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("barbers")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", barberId);

    if (updateError) {
      toast({ title: "Erro", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: "Foto atualizada!" });
      fetchBarbers();
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
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do barbeiro" className="bg-secondary border-border" maxLength={100} />
        <div className="grid grid-cols-3 gap-3">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="bg-secondary border-border" maxLength={20} />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="bg-secondary border-border" maxLength={100} />
          <div>
            <Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="% Comissão" className="bg-secondary border-border" min="0" max="100" />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={adding || !name.trim()} className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90">
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
        <div className="space-y-4">
          {/* Active barbers */}
          <div className="space-y-2">
            {barbers.filter((b) => b.active).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="relative group">
                  <Avatar className="h-10 w-10">
                    {b.avatar_url ? (
                      <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-secondary text-xs font-bold">
                      {b.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="h-3.5 w-3.5 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(b.id, file);
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.phone || b.email || "Sem contato"} • {b.commission_pct}% comissão
                  </p>
                </div>
                <button
                  onClick={() => handleArchive(b.id, true)}
                  className="text-muted-foreground hover:text-yellow-400 shrink-0"
                  title="Arquivar barbeiro"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Archived barbers */}
          {barbers.some((b) => !b.active) && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Arquivados</p>
              <div className="space-y-2">
                {barbers.filter((b) => !b.active).map((b) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 opacity-60">
                    <Avatar className="h-10 w-10">
                      {b.avatar_url ? (
                        <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="bg-secondary text-xs font-bold">
                        {b.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.commission_pct}% comissão • Arquivado
                      </p>
                    </div>
                    <button
                      onClick={() => handleArchive(b.id, false)}
                      className="text-muted-foreground hover:text-green-400 shrink-0"
                      title="Reativar barbeiro"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamTab;
