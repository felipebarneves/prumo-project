-- =============================================================================
-- Adiciona os estágios do funil comercial (Tela 1 — Projetos) ao enum
-- public.status_ciclo_vida, criado em 00003_viabilidade_schema.sql.
--
-- Só ADICIONA valores — Postgres não permite remover/renomear valores de um
-- ENUM sem recriar o tipo inteiro, e contratos.status_ciclo_vida já tem NOT
-- NULL DEFAULT 'em_prospeccao' com linhas potencialmente usando os valores
-- antigos ('contrato_assinado', 'em_execucao', 'encerrado', 'cancelado').
-- Esses valores legados permanecem válidos no banco (para não invalidar
-- dados existentes) mas deixam de ser oferecidos pela API/UI — ver
-- apps/api/app/modules/viabilidade/schemas/common.py (StatusCicloVida).
--
-- ALTER TYPE ... ADD VALUE não pode rodar dentro do mesmo bloco de transação
-- em que o valor é usado, mas pode ser adicionado livremente aqui: cada
-- statement roda isolado (fora de uma transação explícita), e nenhum insert/
-- update desta mesma migration usa os valores novos.
-- =============================================================================

ALTER TYPE public.status_ciclo_vida ADD VALUE IF NOT EXISTS 'em_elaboracao' AFTER 'em_prospeccao';
ALTER TYPE public.status_ciclo_vida ADD VALUE IF NOT EXISTS 'proposta_enviada' AFTER 'em_elaboracao';
ALTER TYPE public.status_ciclo_vida ADD VALUE IF NOT EXISTS 'em_negociacao' AFTER 'proposta_enviada';
ALTER TYPE public.status_ciclo_vida ADD VALUE IF NOT EXISTS 'aprovado_fechado' AFTER 'em_negociacao';
ALTER TYPE public.status_ciclo_vida ADD VALUE IF NOT EXISTS 'perdido_cancelado' AFTER 'aprovado_fechado';

COMMENT ON TYPE public.status_ciclo_vida IS
    'Funil comercial da Tela 1 (Projetos): em_prospeccao -> em_elaboracao -> proposta_enviada -> em_negociacao -> aprovado_fechado | perdido_cancelado. Valores contrato_assinado/em_execucao/encerrado/cancelado são legados, preservados só por compatibilidade com dados existentes.';
