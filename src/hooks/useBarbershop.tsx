import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Barbershop {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  phone: string;
  address: string;
  settings: Record<string, any>;
  created_at: string;
}

export const useBarbershop = () => {
  const { user, loading: authLoading } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }

    supabase
      .from("barbershops")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBarbershop(data as Barbershop | null);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { barbershop, loading: loading || authLoading, user };
};
