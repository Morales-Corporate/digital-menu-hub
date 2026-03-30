import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAdminClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("No authorization header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) throw new Error("No autenticado");

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: isAdmin } = await adminClient.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("No tienes permisos de administrador");

  return adminClient;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = await getAdminClient(req);
    const body = await req.json();
    const { action } = body;

    // CREATE USER
    if (action === "create") {
      const { email, password, full_name } = body;
      if (!email || !password || !full_name) {
        throw new Error("Email, contraseña y nombre son requeridos");
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) throw createError;

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EDIT USER (name, email)
    if (action === "edit") {
      const { user_id, full_name, email } = body;
      if (!user_id) throw new Error("user_id es requerido");

      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (full_name) updates.user_metadata = { full_name };

      if (Object.keys(updates).length > 0) {
        const { error } = await adminClient.auth.admin.updateUser(user_id, updates);
        if (error) throw error;
      }

      // Also update profile
      const profileUpdates: Record<string, unknown> = {};
      if (full_name) profileUpdates.full_name = full_name;
      if (email) profileUpdates.email = email;

      if (Object.keys(profileUpdates).length > 0) {
        await adminClient.from("profiles").update(profileUpdates).eq("id", user_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RESET PASSWORD
    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id) throw new Error("user_id es requerido");
      if (!new_password || new_password.length < 6) {
        throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
      }

      const { error } = await adminClient.auth.admin.updateUser(user_id, {
        password: new_password,
      });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DISABLE USER
    if (action === "disable") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id es requerido");

      const { error } = await adminClient.auth.admin.updateUser(user_id, {
        ban_duration: "876000h",
      });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ENABLE USER
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
