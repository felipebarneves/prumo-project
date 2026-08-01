-- Adicionar colunas de controle do Stripe na tabela de Organizações
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- Adicionar índice para busca rápida pelo Customer ID do Stripe
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id 
ON public.organizations(stripe_customer_id);