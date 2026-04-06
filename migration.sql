-- SplitPay v2: Migration to support Custom Event Participants (Guests)

-- 1. Create the participants table
CREATE TABLE public.participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_evento UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  creado_por UUID REFERENCES public.users(id),
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for participants
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Policies for participants
CREATE POLICY "Participants readable by authenticated users" ON public.participants 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert participants" ON public.participants 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creado_por);

-- 2. Modify expenses to point to participants instead of users
-- First, we need to drop the existing foreign key
ALTER TABLE public.expenses DROP CONSTRAINT expenses_pagado_por_fkey;

-- Since this is development, we will truncate the expenses table to avoid UUID conflicts 
-- before adding the new constraint (which enforces the UUID must exist in participants)
TRUNCATE TABLE public.expenses;

-- Add the new foreign key constraint pointing to the participants table
ALTER TABLE public.expenses 
  ADD CONSTRAINT expenses_pagado_por_fkey 
  FOREIGN KEY (pagado_por) REFERENCES public.participants(id) ON DELETE CASCADE;
