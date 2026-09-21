import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, new_password, barbershop_id } = await req.json();

    if (!user_id || !new_password || !barbershop_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller is owner or admin
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller owns the barbershop or is admin
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleData;

    if (!isAdmin) {
      const { data: shop } = await adminClient.from("barbershops").select("id").eq("id", barbershop_id).eq("owner_id", caller.id).maybeSingle();
      if (!shop) {
        return new Response(JSON.stringify({ error: "Sem permissão para gerenciar esta clínica" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Verify user to be reset belongs to the given barbershop
    const { data: barberRecord } = await adminClient.from("barbers").select("id").eq("user_id", user_id).eq("barbershop_id", barbershop_id).maybeSingle();
    if (!barberRecord && !isAdmin) {
      return new Response(JSON.stringify({ error: "Profissional não pertence a esta clínica" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
