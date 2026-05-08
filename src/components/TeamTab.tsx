import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Users, Crown, Upload, Archive, ArchiveRestore, KeyRound, Power, PowerOff, Eye, EyeOff, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import UpgradeModal from "@/components/UpgradeModal";

// PONTO DE ATUALIZAÇÃO 4: REMOVIDO `commission_pct` DA INTERFACE
interface Barber {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  avatar_url?: string;
  user_id?: string;
}

const PLAN_LIMITS: Record<string, number> = {
  essential: 2,
  bronze: 1,
  prata: 5,
  ouro: Infinity,
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
  // PONTO DE ATUALIZAÇÃO 4: REMOVIDO ESTADO DE COMISSÃO
  // const [commission, setCommission] = useState("50"); 
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Access management state
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccess, setCreatingAccess] = useState<string | null>(null);

  const limit = PLAN_LIMITS[planName] ?? 2;

  const fetchBarbers = async () => {
    const { data } = await (supabase
      .from("barbers") as any)
      .select("id, name, phone, email, active, avatar_url, user_id") // Removido `commission_pct` da query
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
    // PONTO DE ATUALIZAÇÃO 4: REMOVIDO `commission_pct` DO INSERT
    const { error } = await (supabase.from("barbers") as any).insert({
      barbershop_id: barbershopId,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profissional adicionado!" });
      setName(""); setPhone(""); setEmail("");
      fetchBarbers();
    }
    setAdding(false);
  };

  const handleArchive = async (id: string, currentActive: boolean) => {
    const { error } = await (supabase.from("barbers") as any)
      .update({ active: !currentActive })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentActive ? "Profissional arquivado" : "Profissional reativado" });
      fetchBarbers();
    }
  };

  const handlePhotoUpload = async (barberId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const filePath = `barbers/${barberId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    const { error: updateError } = await (supabase.from("barbers") as any)
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", barberId);
    if (updateError) {
      toast({ title: "Erro", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: "Foto atualizada!" });
      fetchBarbers();
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setAccessPassword(pw);
  };

  const handleCreateAccess = async (barber: Barber) => {
    if (!accessEmail.trim() || !accessPassword.trim()) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    setCreatingAccess(barber.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-barber-account", {
        body: {
          email: accessEmail.trim(),
          password: accessPassword.trim(),
          barber_id: barber.id,
          barber_name: barber.name,
          barbershop_id: barbershopId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Acesso criado!", description: `Login: ${accessEmail.trim()}` });
      setAccessEmail("");
      setAccessPassword("");
      fetchBarbers();
    } catch (err: any) {
      toast({ title: "Erro ao criar acesso", description: err.message, variant: "destructive" });
    }
    setCreatingAccess(null);
  };

  const handleRevokeAccess = async (barber: Barber) => {
    if (!barber.user_id) return;
    try {
      const { error } = await supabase.functions.invoke("revoke-barber-account", {
        body: { user_id: barber.user_id, barber_id: barber.id },
      });
      if (error) throw error;
      toast({ title: "Acesso revogado" });
      fetchBarbers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const activeCount = barbers.filter((b) => b.active).length;

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredPlan={planName === "bronze" ? "Prata" : "Ouro"}
        featureName={`Mais de ${limit} profissionais`}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Equipe</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {activeCount}/{limit === Infinity ? "∞" : limit} profissionais
        </span>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4 transition-all hover:shadow-md">
        <p className="text-sm font-bold text-foreground">Adicionar Novo Profissional</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do profissional" className="bg-background border-input shadow-sm md:col-span-1 h-11" maxLength={100} />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="bg-background border-input shadow-sm h-11" maxLength={20} />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="bg-background border-input shadow-sm h-11" maxLength={100} />
        </div>
        <Button onClick={handleAdd} disabled={adding || !name.trim()} className="w-full h-11 premium-gradient text-primary-foreground font-bold hover:opacity-90 shadow-md">
          {adding ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
          Cadastrar Profissional
          {activeCount >= limit && <Crown className="h-4 w-4 ml-2" />}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : barbers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum profissional cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {/* Active barbers */}
          <div className="space-y-2">
            {barbers.filter((b) => b.active).map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 bg-background/50">
                  <div className="relative group">
                    <Avatar className="h-12 w-12 border-2 border-primary/10 shadow-sm">
                      {b.avatar_url ? <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" /> : null}
                      <AvatarFallback className="bg-primary/5 text-primary text-sm font-black">{b.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <Upload className="h-3.5 w-3.5 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(b.id, file); }} />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-base truncate">{b.name}</p>
                    {/* PONTO DE ATUALIZAÇÃO 4: REMOVIDA MENÇÃO À COMISSÃO */}
                    <p className="text-xs text-muted-foreground truncate">
                      {b.phone || b.email || "Sem contato"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.user_id ? (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">Acesso Ativo</span>
                    ) : (
                      <span className="text-[10px] font-black text-muted-foreground bg-secondary px-2.5 py-1 rounded-full uppercase tracking-wider">Sem Acesso</span>
                    )}
                    <button onClick={() => handleArchive(b.id, true)} className="text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 p-2 rounded-lg transition-colors shrink-0" title="Arquivar profissional">
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Access Management */}
                {!b.user_id ? (
                  <div className="border-t border-border bg-card/40 p-5 space-y-4">
                    <p className="text-[11px] font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" /> Criar Acesso ao Sistema
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        type="email"
                        value={creatingAccess === b.id ? accessEmail : ""}
                        onChange={(e) => { setCreatingAccess(b.id); setAccessEmail(e.target.value); }}
                        onFocus={() => setCreatingAccess(b.id)}
                        placeholder="E-mail do profissional"
                        className="bg-background border-input shadow-sm text-sm h-11"
                      />
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={creatingAccess === b.id ? accessPassword : ""}
                          onChange={(e) => { setCreatingAccess(b.id); setAccessPassword(e.target.value); }}
                          onFocus={() => setCreatingAccess(b.id)}
                          placeholder="Senha"
                          className="bg-background border-input shadow-sm text-sm h-11 pr-20"
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1 text-muted-foreground hover:text-foreground">
                            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                          <button type="button" onClick={generatePassword} className="p-1 text-muted-foreground hover:text-primary" title="Gerar senha">
                            <KeyRound className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {creatingAccess === b.id && accessPassword && (
                      <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-muted-foreground flex-1">Senha: <span className="font-mono font-bold text-foreground">{accessPassword}</span></p>
                        <button onClick={() => { navigator.clipboard.writeText(accessPassword); toast({ title: "Senha copiada!" }); }} className="text-muted-foreground hover:text-primary">
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleCreateAccess(b)}
                      disabled={creatingAccess === b.id && (!accessEmail || !accessPassword)}
                      className="w-full h-11 text-sm premium-gradient text-primary-foreground font-bold shadow-md"
                    >
                      {creatingAccess === b.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Power className="h-4 w-4 mr-2" />}
                      Ativar Acesso
                    </Button>
                  </div>
                ) : (
                  <div className="border-t border-border bg-emerald-500/5 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <p className="text-xs font-bold text-emerald-600/80 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Acesso vinculado e ativo
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRevokeAccess(b)}
                      className="h-9 text-xs font-bold px-4"
                    >
                      <PowerOff className="h-3.5 w-3.5 mr-2" /> Revogar Acesso
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Archived barbers */}
          {barbers.some((b) => !b.active) && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Arquivados</p>
              <div className="space-y-2">
                {barbers.filter((b) => !b.active).map((b) => (
                  <div key={b.id} className="flex items-center gap-4 rounded-xl border border-border bg-card/50 px-5 py-4 opacity-70 grayscale hover:grayscale-0 transition-all">
                    <Avatar className="h-10 w-10 border border-primary/10">
                      {b.avatar_url ? <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" /> : null}
                      <AvatarFallback className="bg-secondary text-muted-foreground text-xs font-bold">{b.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground truncate">Arquivado</p>
                    </div>
                    <button onClick={() => handleArchive(b.id, false)} className="text-muted-foreground hover:text-green-400 shrink-0" title="Reativar profissional">
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
