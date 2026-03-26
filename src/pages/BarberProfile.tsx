import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Camera, Save, ArrowLeft, User, Mail, Lock, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const BarberProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: barber, isLoading } = useQuery({
    queryKey: ["barber-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("barbers") as any)
        .select("*, barbershops:barbershop_id(name, logo_url)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setName(data.name);
        setEmail(data.email || user?.email || "");
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Update barber name in barbers table
      const { error } = await (supabase.from("barbers") as any)
        .update({ name: name.trim() })
        .eq("user_id", user!.id);
      if (error) throw error;

      // Update password if provided
      if (newPassword.length >= 6) {
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) throw pwError;
      }
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["barber-profile"] });
      queryClient.invalidateQueries({ queryKey: ["barber-self"] });
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !barber) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${barber.barbershop_id}/barber-${barber.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("barber-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("barber-photos").getPublicUrl(path);
      
      await (supabase.from("barbers") as any)
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", barber.id);
      
      queryClient.invalidateQueries({ queryKey: ["barber-profile"] });
      queryClient.invalidateQueries({ queryKey: ["barber-self"] });
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/barber/dashboard")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-bold">Meu Perfil</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-secondary border-2 border-border overflow-hidden flex items-center justify-center">
              {barber?.avatar_url ? (
                <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:scale-105 transition-transform"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <p className="text-xs text-muted-foreground">{(barber as any)?.barbershops?.name}</p>
        </div>

        {/* Name */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <User className="h-3 w-3" /> Nome
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border h-11" />
          </CardContent>
        </Card>

        {/* Email (read-only) */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> E-mail
            </label>
            <Input value={email} disabled className="bg-muted border-border h-11 opacity-60" />
            <p className="text-[10px] text-muted-foreground">O e-mail não pode ser alterado. Contate o administrador.</p>
          </CardContent>
        </Card>

        {/* Commission (read-only) */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="h-3 w-3" /> Taxa de Comissão
            </label>
            <Input value={`${barber?.commission_pct || 0}%`} disabled className="bg-muted border-border h-11 opacity-60 font-bold" />
            <p className="text-[10px] text-muted-foreground">Definida pelo administrador da barbearia.</p>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Alterar Senha
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="bg-secondary border-border h-11"
            />
          </CardContent>
        </Card>

        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !name.trim()}
          className="w-full h-12 gold-gradient text-primary-foreground font-black rounded-xl shadow-gold"
        >
          {updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
};

export default BarberProfile;
