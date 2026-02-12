import { useEffect, useState, useCallback } from "react";
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
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [loading, setLoading] = useState(true);

  const clearImpersonation = useCallback(() => {
    localStorage.removeItem("impersonate_barbershop_id");
  }, []);

  const refetch = useCallback(async () => {
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }

    // Check for impersonation mode (admin only)
    const impersonateId = localStorage.getItem("impersonate_barbershop_id");
    if (impersonateId && isAdmin) {
      const { data } = await supabase
        .from("barbershops")
        .select("*")
        .eq("id", impersonateId)
        .maybeSingle();
      if (data) {
        setBarbershop(data as Barbershop);
        setLoading(false);
        return;
      }
    }

    const { data } = await supabase
      .from("barbershops")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    setBarbershop(data as Barbershop | null);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [user, authLoading, refetch]);

  return { barbershop, loading: loading || authLoading, user, refetch, clearImpersonation };
};
