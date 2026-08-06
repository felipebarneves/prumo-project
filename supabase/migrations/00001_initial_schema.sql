-- 1. Enum para os Papéis na Organização
DO $$ BEGIN
    CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'executor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabela de Organizações (PMEs)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    document_id TEXT, -- CNPJ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Perfis de Usuários (Vinculado ao Auth do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Associação Usuário <-> Organização (Com Roles e Módulos Ativos)
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.organization_role NOT NULL DEFAULT 'viewer',
    active_modules TEXT[] DEFAULT ARRAY[]::TEXT[], -- Lista de módulos liberados (ex: ['viabilidade'])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 5. Habilitação de Segurança RLS (Row Level Security)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 6. Políticas Base de RLS

-- Usuário só lê a organização se for membro dela
DROP POLICY IF EXISTS "Membros podem ver suas organizações" ON public.organizations;
CREATE POLICY "Membros podem ver suas organizações" 
ON public.organizations FOR SELECT 
USING (
    id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
);

-- Apenas Owner e Admin podem alterar dados da organização
DROP POLICY IF EXISTS "Apenas Admin/Owner altera organização" ON public.organizations;
CREATE POLICY "Apenas Admin/Owner altera organização" 
ON public.organizations FOR UPDATE 
USING (
    id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);