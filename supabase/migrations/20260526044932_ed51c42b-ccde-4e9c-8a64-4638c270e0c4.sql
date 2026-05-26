
-- =========================================================
-- SaaS Multi-Tenant Phase 1: Schema + Backfill + Core RLS
-- =========================================================

-- 1) ENUMS
DO $$ BEGIN
  CREATE TYPE public.business_plan AS ENUM ('trial','basic','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.business_status AS ENUM ('active','expired','suspended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.business_user_role AS ENUM ('owner','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) CORE SAAS TABLES
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  plan public.business_plan NOT NULL DEFAULT 'trial',
  status public.business_status NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_business ON public.businesses (is_default) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.business_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_business public.business_user_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bu_user ON public.business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_bu_biz ON public.business_users(business_id);

CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  previous jsonb,
  next jsonb,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_se_biz ON public.subscription_events(business_id, created_at DESC);

-- 3) BACKFILL DEFAULT BUSINESS
INSERT INTO public.businesses (id, name, slug, plan, status, is_default, feature_flags)
SELECT gen_random_uuid(), 'Negocio Principal', 'principal', 'pro', 'active', true,
       '{"delivery":true,"advanced_reports":true,"multi_branch":false,"unlimited_users":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE is_default = true);

-- Link all existing auth users to default business as staff (admins as owner)
INSERT INTO public.business_users (business_id, user_id, role_in_business)
SELECT b.id, ur.user_id, CASE WHEN ur.role::text = 'admin' THEN 'owner'::public.business_user_role ELSE 'staff'::public.business_user_role END
FROM public.businesses b
CROSS JOIN public.user_roles ur
WHERE b.is_default = true
ON CONFLICT (business_id, user_id) DO NOTHING;

-- 4) HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.default_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.businesses WHERE is_default = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT business_id FROM public.business_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1),
    public.default_business_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_in_business(_uid uuid, _bid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_users WHERE user_id = _uid AND business_id = _bid)
$$;

CREATE OR REPLACE FUNCTION public.business_is_operational(_bid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = _bid
      AND b.status = 'active'
      AND (b.subscription_ends_at IS NULL OR b.subscription_ends_at > now())
      AND (b.plan <> 'trial' OR b.trial_ends_at IS NULL OR b.trial_ends_at > now())
  )
$$;

-- 5) ADD business_id TO ALL TENANT TABLES + BACKFILL
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'ordenes','orden_items','productos','categorias','insumos','producto_insumos',
    'compras_insumos','menus','menu_opciones','menu_opcion_items','meseros',
    'comprobantes','aperturas_caja','cierres_caja','movimientos_caja',
    'costos_operativos','recompensas','descuentos_activos','puntos_usuario',
    'alertas_stock','alertas_stock_config','configuracion_empresa',
    'asignacion_mesas','roles_custom','rol_permisos','user_roles'
  ];
  default_bid uuid;
BEGIN
  SELECT id INTO default_bid FROM public.businesses WHERE is_default = true;
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid', t);
    EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL', t, default_bid);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT public.default_business_id()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_business ON public.%I(business_id)', t, t);
  END LOOP;
END $$;

-- 6) ENABLE RLS ON NEW TABLES
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- businesses policies
DROP POLICY IF EXISTS "Users can view their businesses" ON public.businesses;
CREATE POLICY "Users can view their businesses" ON public.businesses FOR SELECT
USING (public.user_in_business(auth.uid(), id) OR public.is_super_admin(auth.uid()) OR is_default = true);

DROP POLICY IF EXISTS "Super admins manage businesses" ON public.businesses;
CREATE POLICY "Super admins manage businesses" ON public.businesses FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Owners can update their business" ON public.businesses;
CREATE POLICY "Owners can update their business" ON public.businesses FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id = id AND bu.user_id = auth.uid() AND bu.role_in_business = 'owner'));

-- business_users policies
DROP POLICY IF EXISTS "Members view membership" ON public.business_users;
CREATE POLICY "Members view membership" ON public.business_users FOR SELECT
USING (user_id = auth.uid() OR public.user_in_business(auth.uid(), business_id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Owners manage membership" ON public.business_users;
CREATE POLICY "Owners manage membership" ON public.business_users FOR ALL
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id = business_users.business_id AND bu.user_id = auth.uid() AND bu.role_in_business = 'owner')
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id = business_users.business_id AND bu.user_id = auth.uid() AND bu.role_in_business = 'owner')
);

-- super_admins policies (only super admins)
DROP POLICY IF EXISTS "Super admins read" ON public.super_admins;
CREATE POLICY "Super admins read" ON public.super_admins FOR SELECT USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admins manage" ON public.super_admins;
CREATE POLICY "Super admins manage" ON public.super_admins FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- subscription_events
DROP POLICY IF EXISTS "Super admins manage events" ON public.subscription_events;
CREATE POLICY "Super admins manage events" ON public.subscription_events FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Members read events" ON public.subscription_events;
CREATE POLICY "Members read events" ON public.subscription_events FOR SELECT
USING (public.user_in_business(auth.uid(), business_id) OR public.is_super_admin(auth.uid()));

-- 7) updated_at trigger for businesses
DROP TRIGGER IF EXISTS update_businesses_updated_at ON public.businesses;
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) handle_new_user: auto-create a business + ownership on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_biz_id uuid;
  biz_count int;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, business_id)
  VALUES (NEW.id, 'user', public.default_business_id())
  ON CONFLICT DO NOTHING;

  -- Only create a new business for the very first signup pattern via metadata flag
  IF (NEW.raw_user_meta_data ->> 'create_business') = 'true' THEN
    INSERT INTO public.businesses (name, plan, status, trial_ends_at, owner_user_id, feature_flags)
    VALUES (
      COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Mi Negocio'),
      'trial', 'active', now() + interval '30 days', NEW.id,
      '{"delivery":true,"advanced_reports":false,"multi_branch":false,"unlimited_users":false}'::jsonb
    ) RETURNING id INTO new_biz_id;

    INSERT INTO public.business_users (business_id, user_id, role_in_business)
    VALUES (new_biz_id, NEW.id, 'owner');
  ELSE
    -- legacy: attach to default
    INSERT INTO public.business_users (business_id, user_id, role_in_business)
    VALUES (public.default_business_id(), NEW.id, 'staff')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
