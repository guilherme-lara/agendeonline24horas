import TeamTab from "@/components/TeamTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Profissionais = () => {
  const { barbershop, loading } = useBarbershop();
  const [planName, setPlanName] = useState("essential");

  useEffect(() => {
    if (!barbershop) return;
    supabase.from("saas_plans").select("plan_name").eq("barbershop_id", barbershop.id).eq("status", "active").maybeSingle()
      .then(({ data }) => { if (data) setPlanName(data.plan_name); });
  }, [barbershop]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <TeamTab barbershopId={barbershop.id} planName={planName} />
    </div>
  );
};

export default Profissionais;
