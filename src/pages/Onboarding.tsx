import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading, refetch } = useBarbershop();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // If user already has a barbershop, redirect to dashboard
  useEffect(() => {
    if (authLoading || shopLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    if (barbershop) { navigate("/dashboard", { replace: true }); return; }
  }, [user, barbershop, authLoading, shopLoading, navigate]);

  const generateSlug = (val: string) =>
    val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(generateSlug(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !slug.trim()) return;

    setLoading(true);
    try {
      const finalSlug = generateSlug(slug);

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from("barbershops")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();

      if (existing) {
        toast({ title: "Slug já em uso", description: "Escolha outro nome para a URL.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: shop, error } = await supabase
        .from("barbershops")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          slug: finalSlug,
          phone: phone.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Link profile to barbershop
      await supabase
        .from("profiles")
        .update({ barbershop_id: shop.id })
        .eq("user_id", user.id);

      // Create default SaaS plan
      await supabase.from("saas_plans").insert({
        barbershop_id: shop.id,
        plan_name: "essential",
      });

      // Refetch barbershop state so redirect works
      await refetch();

      toast({ title: "Barbearia criada!", description: "Bem-vindo ao TechBarber." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || shopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gold-gradient shadow-gold">
            <Scissors className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Configure sua Barbearia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha os dados para criar seu espaço na plataforma
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nome da Barbearia</label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Barbearia do Guilherme"
              className="bg-card border-border"
              required
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">URL do Agendamento</label>
            <div className="flex items-center rounded-md border border-border bg-card overflow-hidden">
              <span className="px-3 text-xs text-muted-foreground bg-secondary border-r border-border py-2.5">/book/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                required
                maxLength={60}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">WhatsApp (opcional)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="bg-card border-border"
              maxLength={20}
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !name.trim() || !slug.trim()}
            className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90 py-6"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
            ) : (
              <>Criar Barbearia <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
