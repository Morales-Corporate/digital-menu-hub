import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with caller's token to check admin role
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("No autenticado");

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No tienes permisos de administrador");

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, full_name, role, telefono } = body;
      if (!email || !password || !full_name) {
        throw new Error("Email, contraseña y nombre son requeridos");
      }

      // Create auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      // Assign role if provided (other than default 'user')
      if (role && role !== "user") {
        await adminClient.from("user_roles").insert({
          user_id: newUser.user.id,
          role,
        });
      }

      // Create mesero record linked to user
      if (role === "mesero") {
        await adminClient.from("meseros").insert({
          nombre: full_name,
          telefono: telefono || null,
          user_id: newUser.user.id,
        });
      }

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disable") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id es requerido");

      // Ban user (disable login)
      const { error } = await adminClient.auth.admin.updateUser(user_id, {
        ban_duration: "876000h", // ~100 years
      });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "enable") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id es requerido");

      const { error } = await adminClient.auth.admin.updateUser(user_id, {
        ban_duration: "none",
      });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Acción no válida");
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
