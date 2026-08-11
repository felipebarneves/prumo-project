-- =============================================================================
-- Tela 1 (Projetos) / subaba "Parâmetros Gerais" (Tela 2) — campo livre de
-- Observações, pedido para completar o card de Informações Gerais com 100%
-- dos campos já coletados na tela de cadastro inicial (Nome do Projeto,
-- Cliente, Nome da Versão, Data de Início, Duração, Prazo de Pagamento) mais
-- um campo de texto livre que ainda não existia em nenhuma tabela do módulo.
-- =============================================================================

ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN public.contratos.observacoes IS 'Notas livres do projeto — sem uso em nenhum cálculo financeiro, apenas exibição/edição na Tela 2.';
