-- SPLITPAY V2 - SUPABASE SCHEMA & RLS POLICIES

-- 1. Create Users Table (Extended profile linked to auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all users (needed to select who paid)
CREATE POLICY "Users are readable by everyone" ON public.users 
  FOR SELECT USING (true);

-- Policy: Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE USING (auth.uid() = id);

-- 2. Create Events Table
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_evento TEXT NOT NULL,
  creado_por UUID REFERENCES public.users(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: Logged in users can see all events (for a collaborative app, or filter by created_por if private)
-- Assuming collaborative: anyone logged in can see events
CREATE POLICY "Events are readable by authenticated users" ON public.events 
  FOR SELECT TO authenticated USING (true);

-- Policy: Authenticated users can insert events
CREATE POLICY "Authenticated users can insert events" ON public.events 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creado_por);

-- Policy: Only creator can update/delete their events
CREATE POLICY "Users can update own events" ON public.events 
  FOR UPDATE TO authenticated USING (auth.uid() = creado_por);


-- 3. Create Expenses Table (with Soft Delete tracking)
CREATE TABLE public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_evento UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  pagado_por UUID REFERENCES public.users(id) NOT NULL,
  creado_por UUID REFERENCES public.users(id) NOT NULL,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'borrado')),
  borrado_por UUID REFERENCES public.users(id),
  fecha_borrado TIMESTAMPTZ,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all expenses
CREATE POLICY "Expenses readable by authenticated users" ON public.expenses 
  FOR SELECT TO authenticated USING (true);

-- Policy: Authenticated users can insert expenses
CREATE POLICY "Authenticated users can insert expenses" ON public.expenses 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creado_por);

-- Policy: Users can update expenses (e.g. for soft delete, everyone in the event should be able to delete)
-- A more permissive update policy for collaborative editing:
CREATE POLICY "Authenticated users can update expenses" ON public.expenses 
  FOR UPDATE TO authenticated USING (true);

-- 4. Automatically create user profile when signing up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nombre)
  VALUES (new.id, new.email, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
