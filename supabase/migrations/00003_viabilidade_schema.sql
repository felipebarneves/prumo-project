-- =============================================================================
-- Módulo: Prumo Viabilidade
-- Baseado em: docs/prd/prd-viabilidade.md
-- Depende de: 00001_initial_schema.sql (organizations, profiles, organization_members)
--             00002_stripe_schema.sql (subscription_status em organizations)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ESTRUTURA COMERCIAL (PRD seção 3.1)
-- -----------------------------------------------------------------------------

CREATE TYPE public.plan_tier AS ENUM ('starter', 'pro_planejamento', 'pro_execucao', 'master');

-- Capacidade por tier — tabela de referência estática (seed abaixo), não editável via API.
CREATE TABLE public.plan_capacities (
    tier public.plan_tier PRIMARY KEY,
    max_executors INTEGER NOT NULL,
    max_viewers INTEGER NOT NULL,
    max_active_contracts INTEGER NOT NULL
);

INSERT INTO public.plan_capacities (tier, max_executors, max_viewers, max_active_contracts) VALUES
    ('starter', 1, 2, 5),
    ('pro_planejamento', 2, 3, 12),
    ('pro_execucao', 2, 4, 15),
    ('master', 3, 7, 25);

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS plan_tier public.plan_tier NOT NULL DEFAULT 'starter';

-- Nota (PRD 3.1.5): subscription_status já existe em organizations (00002) — active/past_due/inactive.
-- Gatekeeping de leitura/escrita por subscription_status é responsabilidade do FastAPI (camada de autorização),
-- não de RLS — RLS garante isolamento de tenant; o backend garante a semântica comercial de bloqueio de escrita.

COMMENT ON TABLE public.plan_capacities IS 'Referência estática de capacidade por tier (PRD 3.1.2). Nunca gravada via API do produto.';

-- -----------------------------------------------------------------------------
-- 2. CONVITES DE USUÁRIO (PRD Tela 9, seção 3.10 / Tela 10, seção 3.11)
-- -----------------------------------------------------------------------------

CREATE TYPE public.invite_status AS ENUM ('pendente', 'aceito', 'expirado', 'cancelado');

CREATE TABLE public.organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.organization_role NOT NULL CHECK (role IN ('executor', 'viewer')),
    status public.invite_status NOT NULL DEFAULT 'pendente',
    token UUID NOT NULL DEFAULT gen_random_uuid(),
    invited_by UUID NOT NULL REFERENCES public.profiles(id),
    accepted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE (organization_id, email, status) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX idx_organization_invites_token ON public.organization_invites(token);

COMMENT ON TABLE public.organization_invites IS 'Convite só conta no limite de Usuários do plano após status = aceito (PRD US-J1, US-K3).';

-- Preferência de tema (PRD Tela 9, seção 3.10) — por usuário, não por organização.
CREATE TYPE public.theme_preference AS ENUM ('claro', 'escuro');

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS theme_preference public.theme_preference NOT NULL DEFAULT 'escuro';

-- -----------------------------------------------------------------------------
-- 3. CONTRATO MESTRE (PRD Tela 1, seção 3.2)
-- -----------------------------------------------------------------------------

CREATE TYPE public.regime_tributario AS ENUM ('lucro_presumido', 'lucro_real');

CREATE TYPE public.status_ciclo_vida AS ENUM (
    'em_prospeccao', 'contrato_assinado', 'em_execucao', 'encerrado', 'cancelado'
);

CREATE TYPE public.modulo_prumo AS ENUM ('precificacao', 'viabilidade', 'gestao');

-- Entidade compartilhada entre os 3 módulos do Prumo. Este schema é o dono de
-- registro (source of truth) da entidade contrato_id mestre — Precificação e
-- Gestão, quando implementados, referenciam este mesmo id.
CREATE TABLE public.contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    nome_projeto TEXT NOT NULL,
    cliente TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    duracao_meses INTEGER NOT NULL CHECK (duracao_meses >= 1),
    nome_contrato TEXT NOT NULL,
    prazo_pagamento_dias INTEGER NOT NULL CHECK (prazo_pagamento_dias IN (30, 60, 90)),
    regime_tributario public.regime_tributario NOT NULL,
    status_ciclo_vida public.status_ciclo_vida NOT NULL DEFAULT 'em_prospeccao',
    moeda TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
    codigo_interno TEXT,
    segmento_cliente_final TEXT,
    arquivado_em TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contratos_organization_id ON public.contratos(organization_id);
CREATE INDEX idx_contratos_org_arquivado ON public.contratos(organization_id, arquivado_em);

COMMENT ON COLUMN public.contratos.regime_tributario IS 'Imutável após criação (PRD 3.2) — enforce no FastAPI, não editável em nenhum endpoint de update.';
COMMENT ON COLUMN public.contratos.arquivado_em IS 'NULL = ativo (conta no limite do tier). Preenchido = arquivado (fora da contagem, leitura preservada). Distinto de exclusão permanente (DELETE).';

-- Vínculo entre módulos adjacentes na cadeia Precificação <-> Viabilidade <-> Gestão.
-- Guarda apenas a referência de vínculo; a importação por cópia das linhas ocorre
-- em linhas_receita/linhas_custo via origem_line_id no momento em que o vínculo é criado.
CREATE TABLE public.contrato_modulo_vinculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
    modulo public.modulo_prumo NOT NULL CHECK (modulo IN ('precificacao', 'gestao')),
    contrato_origem_id UUID NOT NULL, -- contrato_id mestre no módulo adjacente (FK cruzada fora do escopo deste schema)
    vinculado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    desvinculado_em TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    UNIQUE (contrato_id, modulo)
);

CREATE INDEX idx_contrato_modulo_vinculos_contrato_id ON public.contrato_modulo_vinculos(contrato_id);

COMMENT ON TABLE public.contrato_modulo_vinculos IS 'Vínculo 1:1 por par adjacente na cadeia (PRD 1.3). Desvincular preenche desvinculado_em em vez de excluir a linha (auditoria).';

-- -----------------------------------------------------------------------------
-- 4. VERSÕES (PRD Tela 7, seção 3.8) — nota retroativa: versao_id é chave
--    transversal de todo o schema das seções 5 a 8 abaixo.
-- -----------------------------------------------------------------------------

CREATE TABLE public.versoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
    nome_versao TEXT NOT NULL,
    origem_versao_id UUID REFERENCES public.versoes(id), -- se criada por "Duplicar" (Tela 7)
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_versoes_contrato_id ON public.versoes(contrato_id);

COMMENT ON TABLE public.versoes IS 'Sem versão principal/ativa marcada — a mais recente por created_at abre por padrão (PRD 3.8). Exclusão bloqueada no FastAPI se for a última versão do contrato.';

-- -----------------------------------------------------------------------------
-- 5. PARÂMETROS GERAIS DA VERSÃO (PRD Tela 2, seção 3.3)
-- -----------------------------------------------------------------------------

CREATE TABLE public.parametros_versao (
    versao_id UUID PRIMARY KEY REFERENCES public.versoes(id) ON DELETE CASCADE,
    aliquota_tributaria_efetiva NUMERIC(7, 4) NOT NULL CHECK (aliquota_tributaria_efetiva >= 0),
    tma NUMERIC(7, 4) CHECK (tma IS NULL OR tma >= 0),
    taxa_reinvestimento NUMERIC(7, 4) CHECK (taxa_reinvestimento IS NULL OR taxa_reinvestimento >= 0),
    taxa_custo_captacao NUMERIC(7, 4) CHECK (taxa_custo_captacao IS NULL OR taxa_custo_captacao >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN public.parametros_versao.tma IS 'NULL = "não calcular" VPL (exibe —). Nunca usar 0 como sentinela de ausência (PRD 3.3).';
COMMENT ON COLUMN public.parametros_versao.taxa_reinvestimento IS 'NULL = "não calcular" TIRM (exibe —).';
COMMENT ON COLUMN public.parametros_versao.taxa_custo_captacao IS 'NULL = Custo Financeiro calculado como ZERO (resultado válido, não —) — regra oposta às duas taxas acima.';

-- -----------------------------------------------------------------------------
-- 6. LINHAS DE RECEITA E CUSTO (PRD Tela 2, seções 3.3) + DISTRIBUIÇÃO (Tela 3, 3.4)
-- -----------------------------------------------------------------------------

CREATE TABLE public.linhas_receita (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    mes_inicio INTEGER CHECK (mes_inicio IS NULL OR mes_inicio >= 1),
    prazo_meses INTEGER CHECK (prazo_meses IS NULL OR prazo_meses >= 1),
    unidade_medida TEXT NOT NULL,
    volumetria NUMERIC(18, 4) NOT NULL CHECK (volumetria >= 0),
    valor_unitario NUMERIC(18, 4) NOT NULL CHECK (valor_unitario >= 0),
    aliquota_especifica NUMERIC(7, 4) CHECK (aliquota_especifica IS NULL OR aliquota_especifica >= 0),
    origem_line_id UUID, -- rastreio de importação de Precificação; não é FK de leitura ao vivo (PRD 3.3)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_linhas_receita_versao_id ON public.linhas_receita(versao_id);

CREATE TABLE public.linhas_custo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    mes_inicio INTEGER CHECK (mes_inicio IS NULL OR mes_inicio >= 1),
    prazo_meses INTEGER CHECK (prazo_meses IS NULL OR prazo_meses >= 1),
    unidade_medida TEXT NOT NULL,
    volumetria NUMERIC(18, 4) NOT NULL CHECK (volumetria >= 0),
    custo_unitario NUMERIC(18, 4) NOT NULL CHECK (custo_unitario >= 0),
    origem_line_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_linhas_custo_versao_id ON public.linhas_custo(versao_id);

COMMENT ON COLUMN public.linhas_receita.origem_line_id IS 'Presente = linha importada, bloqueada para edição de volumetria/prazo/valor unitário enquanto o vínculo estiver ativo (validação no FastAPI).';
COMMENT ON TABLE public.linhas_receita IS 'Total e parâmetros unitários apenas. Valor total é sempre calculado (volumetria × valor_unitario) — nunca persistido como campo próprio (PRD 3.3).';

-- Distribuição temporal (Tela 3) — incide exclusivamente sobre Volumetria.
-- is_override = true diferencia célula editada manualmente da distribuição linear calculada.
-- A distribuição linear em si NÃO é persistida linha a linha; é calculada em tempo de leitura
-- quando não houver overrides. Apenas overrides manuais geram registro nesta tabela.
CREATE TABLE public.distribuicao_receita (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linha_receita_id UUID NOT NULL REFERENCES public.linhas_receita(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes >= 1),
    volumetria NUMERIC(18, 4) NOT NULL CHECK (volumetria >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (linha_receita_id, mes)
);

CREATE TABLE public.distribuicao_custo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linha_custo_id UUID NOT NULL REFERENCES public.linhas_custo(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes >= 1),
    volumetria NUMERIC(18, 4) NOT NULL CHECK (volumetria >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (linha_custo_id, mes)
);

CREATE INDEX idx_distribuicao_receita_linha_id ON public.distribuicao_receita(linha_receita_id);
CREATE INDEX idx_distribuicao_custo_linha_id ON public.distribuicao_custo(linha_custo_id);

COMMENT ON TABLE public.distribuicao_receita IS 'Existência de QUALQUER linha aqui para uma linha_receita_id = "possui override manual" — bloqueia edição de volumetria/prazo na Tela 2 até Reset (PRD 3.3, 3.4).';

-- -----------------------------------------------------------------------------
-- 7. DESPESAS NÃO OPERACIONAIS (PRD Tela 2, seção 5b / PRD 3.3)
-- -----------------------------------------------------------------------------

CREATE TYPE public.despesa_tipo AS ENUM ('despesa', 'recuperacao');

CREATE TABLE public.despesas_nao_operacionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    tipo public.despesa_tipo NOT NULL,
    percentual NUMERIC(7, 4) NOT NULL CHECK (percentual >= 0),
    linha_receita_referencia_id UUID REFERENCES public.linhas_receita(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_despesas_nao_operacionais_versao_id ON public.despesas_nao_operacionais(versao_id);

COMMENT ON TABLE public.despesas_nao_operacionais IS 'Sem schema de distribuição temporal próprio — valor mensal sempre calculado em tempo de leitura (percentual × receita mensal da referência, ou da Receita Bruta Total se linha_receita_referencia_id for NULL). Custo Financeiro NÃO é uma linha desta tabela — é projeção calculada de parametros_versao.taxa_custo_captacao (PRD 3.3).';

-- -----------------------------------------------------------------------------
-- 8. CENÁRIOS / SNAPSHOTS SALVOS (PRD Tela 7, seção 3.8)
-- -----------------------------------------------------------------------------

CREATE TYPE public.snapshot_tipo AS ENUM ('comparacao', 'whatif');

CREATE TABLE public.versao_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
    tipo public.snapshot_tipo NOT NULL,
    nome TEXT NOT NULL,
    versao_a_id UUID NOT NULL REFERENCES public.versoes(id),
    versao_b_id UUID REFERENCES public.versoes(id), -- NULL para whatif (uma única versão-base)
    ajustes_whatif JSONB, -- {ajuste_receita_pct, ajuste_custo_pct, ajuste_volumetria_receita_pct} — apenas quando tipo = whatif
    resultado JSONB NOT NULL, -- payload congelado no momento do "Salvar" — nunca recalculado
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_versao_snapshots_contrato_id ON public.versao_snapshots(contrato_id);

COMMENT ON COLUMN public.versao_snapshots.resultado IS 'Snapshot read-only (PRD 3.8) — alterações posteriores nas versões-base não propagam para cá.';

-- -----------------------------------------------------------------------------
-- 9. FUNÇÕES AUXILIARES DE RLS
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER + search_path fixo: evitam recursão de RLS ao consultar
-- organization_members/contratos/versoes de dentro de políticas de tabelas filhas,
-- e evitam sequestro de search_path (boas práticas de segurança do Supabase).

CREATE OR REPLACE FUNCTION public.viabilidade_org_role(p_organization_id UUID)
RETURNS public.organization_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.organization_members
    WHERE organization_id = p_organization_id AND user_id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.viabilidade_org_id_for_contrato(p_contrato_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT organization_id FROM public.contratos WHERE id = p_contrato_id;
$$;

CREATE OR REPLACE FUNCTION public.viabilidade_org_id_for_versao(p_versao_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT c.organization_id
    FROM public.versoes v
    JOIN public.contratos c ON c.id = v.contrato_id
    WHERE v.id = p_versao_id;
$$;

COMMENT ON FUNCTION public.viabilidade_org_role IS 'Retorna o papel do usuário autenticado na organização, ou NULL se não for membro. Usado nas políticas RLS abaixo.';

-- -----------------------------------------------------------------------------
-- 10. HABILITAÇÃO DE RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.plan_capacities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_modulo_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_versao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linhas_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linhas_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_nao_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versao_snapshots ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 11. POLÍTICAS RLS
-- -----------------------------------------------------------------------------

-- plan_capacities: tabela de referência, leitura pública para qualquer usuário autenticado.
CREATE POLICY "Qualquer usuário autenticado lê capacidades de plano"
ON public.plan_capacities FOR SELECT
TO authenticated
USING (true);

-- organization_invites: Owner gerencia; convidado vê o próprio convite pelo token (via endpoint,
-- não via RLS direta — o SELECT por token público é resolvido no FastAPI com service role).
CREATE POLICY "Owner vê convites da própria organização"
ON public.organization_invites FOR SELECT
USING (public.viabilidade_org_role(organization_id) = 'owner');

CREATE POLICY "Owner cria convites"
ON public.organization_invites FOR INSERT
WITH CHECK (public.viabilidade_org_role(organization_id) = 'owner');

CREATE POLICY "Owner atualiza convites (papel, status, cancelamento)"
ON public.organization_invites FOR UPDATE
USING (public.viabilidade_org_role(organization_id) = 'owner');

-- contratos (PRD 3.2, seção 7 da Tela 1: Owner e Executor escrevem; Viewer só lê)
CREATE POLICY "Membros da organização veem contratos"
ON public.contratos FOR SELECT
USING (public.viabilidade_org_role(organization_id) IS NOT NULL);

CREATE POLICY "Owner/Executor cria contratos"
ON public.contratos FOR INSERT
WITH CHECK (public.viabilidade_org_role(organization_id) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor edita e arquiva/desarquiva contratos"
ON public.contratos FOR UPDATE
USING (public.viabilidade_org_role(organization_id) IN ('owner', 'executor'));

CREATE POLICY "Apenas Owner exclui contratos permanentemente"
ON public.contratos FOR DELETE
USING (public.viabilidade_org_role(organization_id) = 'owner');

-- contrato_modulo_vinculos
CREATE POLICY "Membros veem vínculos de módulo"
ON public.contrato_modulo_vinculos FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor vincula módulo"
ON public.contrato_modulo_vinculos FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor desvincula módulo"
ON public.contrato_modulo_vinculos FOR UPDATE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

-- versoes (PRD 3.8: criação/exclusão/renomeação por Owner/Executor; leitura para todos os papéis)
CREATE POLICY "Membros veem versões"
ON public.versoes FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor cria versões"
ON public.versoes FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor edita (renomeia) versões"
ON public.versoes FOR UPDATE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor exclui versões"
ON public.versoes FOR DELETE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

-- parametros_versao, linhas_receita, linhas_custo, distribuicao_*, despesas_nao_operacionais:
-- mesmo padrão de acesso (leitura para todos os papéis; escrita Owner/Executor), escopado por versao_id.

CREATE POLICY "Membros veem parâmetros da versão"
ON public.parametros_versao FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor grava parâmetros da versão"
ON public.parametros_versao FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor atualiza parâmetros da versão"
ON public.parametros_versao FOR UPDATE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Membros veem linhas de receita"
ON public.linhas_receita FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor grava linhas de receita"
ON public.linhas_receita FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor atualiza linhas de receita"
ON public.linhas_receita FOR UPDATE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor exclui linhas de receita"
ON public.linhas_receita FOR DELETE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Membros veem linhas de custo"
ON public.linhas_custo FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor grava linhas de custo"
ON public.linhas_custo FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor atualiza linhas de custo"
ON public.linhas_custo FOR UPDATE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor exclui linhas de custo"
ON public.linhas_custo FOR DELETE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Membros veem distribuição de receita"
ON public.distribuicao_receita FOR SELECT
USING (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_receita WHERE id = linha_receita_id))
    ) IS NOT NULL
);

CREATE POLICY "Owner/Executor grava distribuição de receita"
ON public.distribuicao_receita FOR INSERT
WITH CHECK (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_receita WHERE id = linha_receita_id))
    ) IN ('owner', 'executor')
);

CREATE POLICY "Owner/Executor atualiza distribuição de receita"
ON public.distribuicao_receita FOR UPDATE
USING (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_receita WHERE id = linha_receita_id))
    ) IN ('owner', 'executor')
);

CREATE POLICY "Owner/Executor exclui distribuição de receita"
ON public.distribuicao_receita FOR DELETE
USING (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_receita WHERE id = linha_receita_id))
    ) IN ('owner', 'executor')
);

CREATE POLICY "Membros veem distribuição de custo"
ON public.distribuicao_custo FOR SELECT
USING (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_custo WHERE id = linha_custo_id))
    ) IS NOT NULL
);

CREATE POLICY "Owner/Executor grava distribuição de custo"
ON public.distribuicao_custo FOR INSERT
WITH CHECK (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_custo WHERE id = linha_custo_id))
    ) IN ('owner', 'executor')
);

CREATE POLICY "Owner/Executor atualiza distribuição de custo"
ON public.distribuicao_custo FOR UPDATE
USING (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_custo WHERE id = linha_custo_id))
    ) IN ('owner', 'executor')
);

CREATE POLICY "Owner/Executor exclui distribuição de custo"
ON public.distribuicao_custo FOR DELETE
USING (
    public.viabilidade_org_role(
        public.viabilidade_org_id_for_versao((SELECT versao_id FROM public.linhas_custo WHERE id = linha_custo_id))
    ) IN ('owner', 'executor')
);

CREATE POLICY "Membros veem despesas não operacionais"
ON public.despesas_nao_operacionais FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor grava despesas não operacionais"
ON public.despesas_nao_operacionais FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor atualiza despesas não operacionais"
ON public.despesas_nao_operacionais FOR UPDATE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor exclui despesas não operacionais"
ON public.despesas_nao_operacionais FOR DELETE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_versao(versao_id)) IN ('owner', 'executor'));

-- versao_snapshots (PRD 3.8: Owner/Executor salvam; leitura para todos os papéis)
CREATE POLICY "Membros veem snapshots salvos"
ON public.versao_snapshots FOR SELECT
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IS NOT NULL);

CREATE POLICY "Owner/Executor salva snapshots"
ON public.versao_snapshots FOR INSERT
WITH CHECK (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

CREATE POLICY "Owner/Executor exclui snapshots salvos"
ON public.versao_snapshots FOR DELETE
USING (public.viabilidade_org_role(public.viabilidade_org_id_for_contrato(contrato_id)) IN ('owner', 'executor'));

-- -----------------------------------------------------------------------------
-- 12. NOTAS DE FRONTEIRA (não implementado nesta migration)
-- -----------------------------------------------------------------------------
-- - Contagem de limite de Contratos Ativos e de Usuários (plan_capacities) é validada
--   no FastAPI antes do INSERT/UPDATE relevante — não há trigger de banco para isso,
--   pois a mensagem de softblock (PRD Tela 1, seção 8) precisa retornar contexto de
--   upsell que pertence à camada de API, não a uma exceção genérica de trigger SQL.
-- - Validação de soma (distribuição vs. total da linha, PRD Tela 3) roda no FastAPI
--   na gravação — não é constraint de banco, pois o desvio é um aviso não-bloqueante.
-- - subscription_status (past_due/inactive) e downgrade de tier bloqueiam ESCRITA por
--   regra de produto, mas RLS aqui permite escrita a Owner/Executor independentemente
--   do status da assinatura — esse gate adicional é aplicado no FastAPI (camada de
--   autorização de negócio), pois depende de estado do Stripe, não de tenant/papel.
