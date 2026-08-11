-- =============================================================================
-- Corrige HTTP 500 na exclusão de versões (Tela 7 / Histórico).
--
-- Causa raiz confirmada via pg_constraint no projeto real: 3 FKs apontando
-- para public.versoes(id) foram criadas em 00003 sem ON DELETE, o que no
-- Postgres é NO ACTION (bloqueia o DELETE com erro 23503 — foreign key
-- violation — sempre que a versão excluída tem QUALQUER linha dependente):
--
--   - versoes.origem_versao_id            (auto-referência: "duplicada de")
--   - versao_snapshots.versao_a_id        (Cenário salvo referencia a versão)
--   - versao_snapshots.versao_b_id
--
-- app/modules/viabilidade/repository.py:excluir_versao() faz um DELETE
-- direto sem tratar esse erro — o postgrest.APIError sobe sem handler até o
-- FastAPI, que responde 500 genérico. parametros_versao/linhas_receita/
-- linhas_custo/despesas_nao_operacionais já tinham ON DELETE CASCADE desde
-- 00003 (por isso só reproduzia com Cenários salvos ou versões duplicadas,
-- não em toda exclusão) — DRE e Fluxo de Caixa não têm tabela própria (são
-- sempre calculados em tempo de leitura a partir dessas), então já não
-- exigiam nenhum tratamento adicional de cascata.
--
-- origem_versao_id vira SET NULL (não CASCADE): apagar a versão-origem não
-- deveria apagar em cascata as versões duplicadas dela — só desfaz o
-- rastreio de linhagem. versao_snapshots.versao_a_id/versao_b_id viram
-- CASCADE: um Cenário salvo sem a versão que ele compara deixa de fazer
-- sentido (PRD Tela 7, "cascata" pedida no bug report).
-- =============================================================================

ALTER TABLE public.versoes
    DROP CONSTRAINT versoes_origem_versao_id_fkey,
    ADD CONSTRAINT versoes_origem_versao_id_fkey
        FOREIGN KEY (origem_versao_id) REFERENCES public.versoes(id) ON DELETE SET NULL;

ALTER TABLE public.versao_snapshots
    DROP CONSTRAINT versao_snapshots_versao_a_id_fkey,
    ADD CONSTRAINT versao_snapshots_versao_a_id_fkey
        FOREIGN KEY (versao_a_id) REFERENCES public.versoes(id) ON DELETE CASCADE;

ALTER TABLE public.versao_snapshots
    DROP CONSTRAINT versao_snapshots_versao_b_id_fkey,
    ADD CONSTRAINT versao_snapshots_versao_b_id_fkey
        FOREIGN KEY (versao_b_id) REFERENCES public.versoes(id) ON DELETE CASCADE;
