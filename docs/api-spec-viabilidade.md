# Contrato de API — Módulo Prumo Viabilidade

**Autor:** Agente Atlas (Arquiteto)
**Base:** `docs/prd/prd-viabilidade.md`
**Schema de dados:** `supabase/migrations/00003_viabilidade_schema.sql`
**Convenções:** FastAPI + Pydantic v2. Todos os valores monetários/percentuais em `Decimal` (nunca `float`). Todas as rotas exigem JWT do Supabase Auth; `organization_id` é resolvido do token, nunca aceito como parâmetro de path/body livre.

> Este documento define contratos (rotas, schemas de entrada/saída, códigos de status). Não implementa as rotas em código — responsabilidade do Kaiser (Backend).

---

## 0. Convenções Globais

### 0.1. Tratamento Padrão de Erros

```python
class ErrorResponse(BaseModel):
    error_code: str        # ex: "LIMITE_PLANO_EXCEDIDO", "VALIDACAO_JANELA_LINHA"
    message: str           # mensagem amigável, pt-BR
    details: dict | None = None
```

| Status | Uso |
|---|---|
| `400` | Erro de validação de regra de negócio (ex: janela de linha excedida, soma de distribuição não fecha em endpoint estrito) |
| `401` | Token ausente/inválido |
| `403` | Papel sem permissão (ex: Viewer tentando escrever) ou `subscription_status` bloqueando escrita |
| `404` | Recurso não encontrado ou fora do tenant do usuário (nunca `403` para não vazar existência entre organizações) |
| `409` | Conflito de estado (ex: excluir última versão, editar linha bloqueada por override/vínculo) |
| `422` | Erro de schema Pydantic (FastAPI padrão) |

### 0.2. Erros Financeiros Padronizados (`error_code`)

| Código | Cenário |
|---|---|
| `LIMITE_PLANO_EXCEDIDO` | Criar/desarquivar contrato ou aceitar convite além da capacidade do tier |
| `ASSINATURA_BLOQUEIA_ESCRITA` | `subscription_status` em `past_due` ou `inactive` |
| `REGIME_TRIBUTARIO_IMUTAVEL` | Tentativa de editar `regime_tributario` após criação |
| `JANELA_LINHA_EXCEDIDA` | `mes_inicio + prazo_meses` fora de `data_inicio + duracao_meses` do contrato |
| `LINHA_BLOQUEADA_POR_ORIGEM` | Edição de total/prazo/unitário em linha com `origem_line_id` ativo |
| `LINHA_BLOQUEADA_POR_OVERRIDE` | Edição de volumetria/prazo em linha com distribuição manual existente |
| `DISTRIBUICAO_SOMA_DIVERGENTE` | Soma da distribuição mensal ≠ total da linha (aviso não-bloqueante — retornado em `200` com `warnings`, não erro) |
| `VERSAO_UNICA_NAO_EXCLUIVEL` | Tentativa de excluir a última versão de um contrato |
| `DURACAO_INVALIDA` | `duracao_meses < 1` |
| `VALOR_NEGATIVO` | Volumetria ou Valor/Custo Unitário negativos |

### 0.3. Enums Compartilhados

```python
class OrganizationRole(str, Enum):
    OWNER = "owner"
    EXECUTOR = "executor"
    VIEWER = "viewer"

class RegimeTributario(str, Enum):
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"

class StatusCicloVida(str, Enum):
    EM_PROSPECCAO = "em_prospeccao"
    CONTRATO_ASSINADO = "contrato_assinado"
    EM_EXECUCAO = "em_execucao"
    ENCERRADO = "encerrado"
    CANCELADO = "cancelado"

class PrazoPagamento(int, Enum):
    D30 = 30
    D60 = 60
    D90 = 90

class ModuloPrumo(str, Enum):
    PRECIFICACAO = "precificacao"
    GESTAO = "gestao"

class DespesaTipo(str, Enum):
    DESPESA = "despesa"
    RECUPERACAO = "recuperacao"

class SnapshotTipo(str, Enum):
    COMPARACAO = "comparacao"
    WHATIF = "whatif"

class GranularidadeResumo(str, Enum):
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"
    ANUAL = "anual"

class PlanTier(str, Enum):
    STARTER = "starter"
    PRO_PLANEJAMENTO = "pro_planejamento"
    PRO_EXECUCAO = "pro_execucao"
    MASTER = "master"
```

### 0.4. Convenção de KPI Não Calculável

Todo campo de KPI que pode ser `—` (não calculado/não atingido) é tipado como `Decimal | None` na saída — `None` serializa para `null` no JSON; o frontend é responsável por renderizar `—`. O backend **nunca** retorna `0` como substituto de "não calculado".

---

## 1. Estrutura Comercial / Gatekeeping (transversal)

Middleware de autorização aplicado a **todas** as rotas de escrita (`POST`/`PUT`/`PATCH`/`DELETE`) deste módulo:

```python
class SubscriptionGate(BaseModel):
    subscription_status: Literal["active", "past_due", "inactive"]
    plan_tier: PlanTier

# Regra (PRD 3.1.4, 3.1.5):
# active     -> libera conforme tier
# past_due   -> bloqueia toda escrita (403 ASSINATURA_BLOQUEIA_ESCRITA), libera leitura/exportação
# inactive   -> bloqueia tudo (403), libera apenas rotas de exportação
```

### `GET /api/v1/organizations/me/plan`
Retorna capacidade e uso corrente do plano (Tela 8 e Tela 9).

```python
class PlanUsageResponse(BaseModel):
    tier: PlanTier
    subscription_status: Literal["active", "past_due", "inactive"]
    max_executors: int
    max_viewers: int
    max_active_contracts: int
    current_executors: int
    current_viewers: int
    current_active_contracts: int
```
`200 OK`

---

## 2. Tela 1 — Cadastro e Consulta de Projetos/Contratos

### `POST /api/v1/contratos`
Permissão: Owner, Executor.

```python
class ContratoCreateRequest(BaseModel):
    nome_projeto: str = Field(min_length=1, max_length=200)
    cliente: str = Field(min_length=1, max_length=200)
    data_inicio: date
    duracao_meses: int = Field(ge=1)
    nome_contrato: str = Field(min_length=1, max_length=200)
    prazo_pagamento_dias: PrazoPagamento
    nome_versao: str = Field(min_length=1, max_length=120)
    regime_tributario: RegimeTributario
    status_ciclo_vida: StatusCicloVida = StatusCicloVida.EM_PROSPECCAO
    codigo_interno: str | None = None
    segmento_cliente_final: str | None = None

class ContratoResponse(BaseModel):
    id: UUID
    organization_id: UUID
    nome_projeto: str
    cliente: str
    data_inicio: date
    duracao_meses: int
    nome_contrato: str
    prazo_pagamento_dias: int
    regime_tributario: RegimeTributario
    status_ciclo_vida: StatusCicloVida
    moeda: Literal["BRL"] = "BRL"
    codigo_interno: str | None
    segmento_cliente_final: str | None
    arquivado_em: datetime | None
    modulos_vinculados: list[ModuloPrumo]
    versao_inicial_id: UUID
    created_at: datetime
```
`201 Created` · `400` (`DURACAO_INVALIDA`) · `403` (`LIMITE_PLANO_EXCEDIDO`, `ASSINATURA_BLOQUEIA_ESCRITA`)

### `GET /api/v1/contratos`
Permissão: qualquer papel.

```python
class ContratoListQuery(BaseModel):
    status_ciclo_vida: StatusCicloVida | None = None
    modulo_vinculado: ModuloPrumo | None = None
    mostrar_arquivados: bool = False
    busca: str | None = None   # nome do projeto ou cliente
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, le=100)

class ContratoListItem(BaseModel):
    id: UUID
    nome_projeto: str
    cliente: str
    status_ciclo_vida: StatusCicloVida
    modulos_vinculados: list[ModuloPrumo]
    arquivado: bool
    created_at: datetime

class ContratoListResponse(BaseModel):
    items: list[ContratoListItem]
    total: int
    page: int
    page_size: int
```
`200 OK`

### `GET /api/v1/contratos/{contrato_id}` → `ContratoResponse` · `404`

### `PATCH /api/v1/contratos/{contrato_id}`
Permissão: Owner, Executor. `regime_tributario` e `moeda` não são campos aceitos neste schema (imutáveis).

```python
class ContratoUpdateRequest(BaseModel):
    nome_projeto: str | None = None
    cliente: str | None = None
    data_inicio: date | None = None
    duracao_meses: int | None = Field(default=None, ge=1)
    nome_contrato: str | None = None
    prazo_pagamento_dias: PrazoPagamento | None = None
    status_ciclo_vida: StatusCicloVida | None = None
    codigo_interno: str | None = None
    segmento_cliente_final: str | None = None
```
`200 OK` · `400` (`REGIME_TRIBUTARIO_IMUTAVEL` se o campo vier no payload bruto) · `403` · `404`

### `POST /api/v1/contratos/{contrato_id}/arquivar`
Permissão: Owner, Executor.

```python
class ArquivarContratoResponse(BaseModel):
    contrato_id: UUID
    modulos_afetados: list[ModuloPrumo]   # para a confirmação de cascata exibida no frontend
    arquivado_em: datetime
```
`200 OK` · `409` (já arquivado)

### `POST /api/v1/contratos/{contrato_id}/desarquivar`
Permissão: Owner, Executor. `403` (`LIMITE_PLANO_EXCEDIDO`) se não houver vaga no tier vigente.

### `DELETE /api/v1/contratos/{contrato_id}`
Permissão: Owner apenas. Exclusão permanente (cascateia versões, linhas, snapshots). `204 No Content` · `403`

### `POST /api/v1/contratos/{contrato_id}/vinculos`
Permissão: Owner, Executor. Cria vínculo com módulo adjacente e dispara importação inicial por cópia.

```python
class VincularModuloRequest(BaseModel):
    modulo: ModuloPrumo
    contrato_origem_id: UUID   # contrato_id mestre no módulo adjacente

class VincularModuloResponse(BaseModel):
    id: UUID
    contrato_id: UUID
    modulo: ModuloPrumo
    contrato_origem_id: UUID
    linhas_importadas_receita: int
    linhas_importadas_custo: int
    vinculado_em: datetime
```
`201 Created` · `409` (vínculo já existe para esse par módulo/contrato)

### `DELETE /api/v1/contratos/{contrato_id}/vinculos/{modulo}`
Permissão: Owner, Executor. Desvincula (preenche `desvinculado_em`; linhas antes importadas tornam-se editáveis). `204 No Content`

---

## 3. Tela 2 — Parâmetros de Input

Todas as rotas abaixo são escopadas por `versao_id` e herdam o `SubscriptionGate` (seção 1).

### `GET /api/v1/versoes/{versao_id}/parametros` / `PUT /api/v1/versoes/{versao_id}/parametros`
Permissão leitura: qualquer papel. Escrita: Owner, Executor.

```python
class ParametrosVersaoRequest(BaseModel):
    aliquota_tributaria_efetiva: Decimal = Field(ge=0, decimal_places=4)
    tma: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    taxa_reinvestimento: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    taxa_custo_captacao: Decimal | None = Field(default=None, ge=0, decimal_places=4)

class ParametrosVersaoResponse(ParametrosVersaoRequest):
    versao_id: UUID
    updated_at: datetime
```
`200 OK` · `403`

### `POST /api/v1/versoes/{versao_id}/linhas-receita`
Permissão: Owner, Executor.

```python
class LinhaReceitaCreateRequest(BaseModel):
    descricao: str = Field(min_length=1, max_length=300)
    mes_inicio: int | None = Field(default=None, ge=1)
    prazo_meses: int | None = Field(default=None, ge=1)
    unidade_medida: str = Field(min_length=1, max_length=40)
    volumetria: Decimal = Field(ge=0, decimal_places=4)
    valor_unitario: Decimal = Field(ge=0, decimal_places=4)
    aliquota_especifica: Decimal | None = Field(default=None, ge=0, decimal_places=4)

class LinhaReceitaResponse(BaseModel):
    id: UUID
    versao_id: UUID
    descricao: str
    mes_inicio: int | None
    prazo_meses: int | None
    unidade_medida: str
    volumetria: Decimal
    valor_unitario: Decimal
    valor_total_calculado: Decimal          # volumetria × valor_unitario, somente leitura
    aliquota_especifica: Decimal | None
    origem_line_id: UUID | None
    bloqueado_por_origem: bool               # derivado de origem_line_id + vínculo ativo
    bloqueado_por_override: bool             # derivado de existência em distribuicao_receita
    created_at: datetime
    updated_at: datetime
```
`201 Created` · `400` (`JANELA_LINHA_EXCEDIDA`, `VALOR_NEGATIVO`)

### `GET /api/v1/versoes/{versao_id}/linhas-receita` → `list[LinhaReceitaResponse]`

### `PATCH /api/v1/versoes/{versao_id}/linhas-receita/{linha_id}`
Permissão: Owner, Executor.

```python
class LinhaReceitaUpdateRequest(BaseModel):
    descricao: str | None = None
    mes_inicio: int | None = None
    prazo_meses: int | None = None
    unidade_medida: str | None = None
    volumetria: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    valor_unitario: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    aliquota_especifica: Decimal | None = None
```
`200 OK` · `409` (`LINHA_BLOQUEADA_POR_ORIGEM` se `volumetria`/`prazo_meses`/`valor_unitario` vierem preenchidos numa linha importada; `LINHA_BLOQUEADA_POR_OVERRIDE` se `volumetria`/`prazo_meses` vierem preenchidos numa linha com distribuição manual existente — `valor_unitario` permanece editável nesse segundo caso)

### `DELETE /api/v1/versoes/{versao_id}/linhas-receita/{linha_id}` → `204` · `403`

### Linhas de Custo — mesmo contrato, sem `aliquota_especifica`
- `POST /api/v1/versoes/{versao_id}/linhas-custo`
- `GET /api/v1/versoes/{versao_id}/linhas-custo`
- `PATCH /api/v1/versoes/{versao_id}/linhas-custo/{linha_id}`
- `DELETE /api/v1/versoes/{versao_id}/linhas-custo/{linha_id}`

```python
class LinhaCustoCreateRequest(BaseModel):
    descricao: str = Field(min_length=1, max_length=300)
    mes_inicio: int | None = Field(default=None, ge=1)
    prazo_meses: int | None = Field(default=None, ge=1)
    unidade_medida: str = Field(min_length=1, max_length=40)
    volumetria: Decimal = Field(ge=0, decimal_places=4)
    custo_unitario: Decimal = Field(ge=0, decimal_places=4)

class LinhaCustoResponse(BaseModel):
    id: UUID
    versao_id: UUID
    descricao: str
    mes_inicio: int | None
    prazo_meses: int | None
    unidade_medida: str
    volumetria: Decimal
    custo_unitario: Decimal
    custo_total_calculado: Decimal
    origem_line_id: UUID | None
    bloqueado_por_origem: bool
    bloqueado_por_override: bool
    created_at: datetime
    updated_at: datetime
```

### Despesas Não Operacionais

```python
class DespesaNaoOperacionalCreateRequest(BaseModel):
    descricao: str = Field(min_length=1, max_length=300)
    tipo: DespesaTipo
    percentual: Decimal = Field(ge=0, decimal_places=4)
    linha_receita_referencia_id: UUID | None = None   # None = aplica sobre Receita Bruta Total

class DespesaNaoOperacionalResponse(DespesaNaoOperacionalCreateRequest):
    id: UUID
    versao_id: UUID
    created_at: datetime
    updated_at: datetime

class CustoFinanceiroProjecaoResponse(BaseModel):
    """Linha automática, não editável — GET only."""
    valores_mensais: list[Decimal]
    total: Decimal
```
- `POST /api/v1/versoes/{versao_id}/despesas-nao-operacionais`
- `GET /api/v1/versoes/{versao_id}/despesas-nao-operacionais`
- `PATCH /api/v1/versoes/{versao_id}/despesas-nao-operacionais/{despesa_id}`
- `DELETE /api/v1/versoes/{versao_id}/despesas-nao-operacionais/{despesa_id}`
- `GET /api/v1/versoes/{versao_id}/despesas-nao-operacionais/custo-financeiro` → `CustoFinanceiroProjecaoResponse`

---

## 4. Tela 3 — Cronograma Físico-Financeiro

### `GET /api/v1/versoes/{versao_id}/cronograma/receita`

```python
class CelulaCronograma(BaseModel):
    mes: int
    volumetria: Decimal | None       # None = fora da janela da linha (célula travada, "—")
    valor_calculado: Decimal | None  # volumetria × valor_unitario; None se fora da janela
    is_override: bool
    dentro_da_janela: bool

class LinhaCronogramaResponse(BaseModel):
    linha_id: UUID
    descricao: str
    total_linha: Decimal
    soma_distribuicao: Decimal
    divergente: bool                  # soma_distribuicao != total_linha
    celulas: list[CelulaCronograma]

class CronogramaResponse(BaseModel):
    versao_id: UUID
    meses: list[int]                  # eixo temporal do projeto
    linhas: list[LinhaCronogramaResponse]
```
`200 OK`

### `PUT /api/v1/versoes/{versao_id}/cronograma/receita/{linha_id}/celulas`
Permissão: Owner, Executor. Grava (ou atualiza) overrides manuais de uma ou mais células.

```python
class CelulaUpdateRequest(BaseModel):
    mes: int = Field(ge=1)
    volumetria: Decimal = Field(ge=0, decimal_places=4)

class CronogramaCelulasUpdateRequest(BaseModel):
    celulas: list[CelulaUpdateRequest] = Field(min_length=1)

class CronogramaCelulasUpdateResponse(BaseModel):
    linha_id: UUID
    soma_distribuicao: Decimal
    total_linha: Decimal
    warning: Literal["DISTRIBUICAO_SOMA_DIVERGENTE"] | None = None
```
`200 OK` (mesmo quando `warning` está presente — não é erro) · `400` (`JANELA_LINHA_EXCEDIDA` se `mes` fora da janela da linha)

### `POST /api/v1/versoes/{versao_id}/cronograma/receita/{linha_id}/reset`
Permissão: Owner, Executor. Remove todos os overrides da linha, retorna à distribuição linear. `200 OK`

### `POST /api/v1/versoes/{versao_id}/cronograma/receita/reset-lote`
Permissão: Owner, Executor. Reset em todas as linhas da aba Receita. `200 OK`

### Espelho completo para Custo
- `GET /api/v1/versoes/{versao_id}/cronograma/custo`
- `PUT /api/v1/versoes/{versao_id}/cronograma/custo/{linha_id}/celulas`
- `POST /api/v1/versoes/{versao_id}/cronograma/custo/{linha_id}/reset`
- `POST /api/v1/versoes/{versao_id}/cronograma/custo/reset-lote`

(mesmos schemas, trocando `LinhaCronogramaResponse`/`CronogramaResponse` para o contexto de custo)

---

## 5. Tela 4 — DRE Detalhado + Resumo DRE

100% leitura — sem rotas de escrita.

```python
class DREItemMensal(BaseModel):
    mes: int
    valor: Decimal

class DRELinha(BaseModel):
    item: Literal[
        "receita_operacional_bruta", "deducoes", "receita_operacional_liquida",
        "custos_operacionais", "ebitda", "despesas_nao_operacionais", "ebit",
        "ebit_acumulado", "irpj", "lucro_liquido",
        "margem_ebitda", "margem_ebit", "margem_liquida",
    ]
    total_projeto: Decimal
    valores_mensais: list[DREItemMensal]   # populado apenas se item != "ebit_acumulado" ou for a linha de acumulado

class DREDetalhadoResponse(BaseModel):
    versao_id: UUID
    meses: list[int]
    linhas: list[DRELinha]
    nota_irpj: str = (
        "O cálculo de IRPJ apresentado utiliza uma fórmula simplificada "
        "(15% + adicional de 10% sobre o EBIT mensal excedente a R$20.000), "
        "aplicada de forma equivalente para os regimes de Lucro Presumido e "
        "Lucro Real neste MVP. Não substitui apuração fiscal formal."
    )
```
`GET /api/v1/versoes/{versao_id}/dre/detalhado` → `DREDetalhadoResponse`

```python
class DREPeriodoConsolidado(BaseModel):
    periodo_label: str      # ex: "2026", "T1 2026"
    valor: Decimal

class DRELinhaResumo(BaseModel):
    item: str
    total_projeto: Decimal
    periodos: list[DREPeriodoConsolidado]

class ResumoDREQuery(BaseModel):
    granularidade: GranularidadeResumo

class ResumoDREResponse(BaseModel):
    versao_id: UUID
    granularidade: GranularidadeResumo
    inicio_projeto: date
    fim_contrato: date
    prazo_meses: int
    linhas: list[DRELinhaResumo]
    nota_irpj: str
```
`GET /api/v1/versoes/{versao_id}/dre/resumo?granularidade=anual` → `ResumoDREResponse`

---

## 6. Tela 5 — Fluxo de Caixa

100% leitura.

```python
class FluxoCaixaLinha(BaseModel):
    item: Literal[
        "entrada_caixa", "deducoes", "saida_caixa", "fluxo_liquido_operacional",
        "despesas_nao_operacionais", "irpj", "fluxo_liquido_geral",
        "fluxo_acumulado", "custo_financeiro", "saldo_caixa_final",
    ]
    valores_mensais: list[Decimal]
    total_projeto: Decimal

class FluxoCaixaResponse(BaseModel):
    versao_id: UUID
    meses: list[int]
    linhas: list[FluxoCaixaLinha]
    capital_de_giro: Decimal          # maior valor negativo do fluxo_acumulado bruto
```
`GET /api/v1/versoes/{versao_id}/fluxo-caixa` → `FluxoCaixaResponse`

---

## 7. Tela 6 — Dashboard do Projeto

100% leitura.

```python
class DashboardKPIs(BaseModel):
    receita_bruta_total: Decimal
    ebitda_total: Decimal
    margem_ebitda: Decimal
    fluxo_liquido_total: Decimal
    vpl: Decimal | None                # None = "—" (TMA não preenchida)
    tir: Decimal | None                # None = "—" (sem troca de sinal)
    tirm: Decimal | None               # None = "—" (Taxa de Reinvestimento não preenchida)
    payback_mes: int | None            # None = "—" (não atingido)
    breakeven_mes: int | None          # None = "—" (não atingido)
    capital_de_giro: Decimal
    custo_financeiro_total: Decimal

class GraficoAnualSerie(BaseModel):
    ano: int
    receita_liquida: Decimal
    custos: Decimal
    ebitda: Decimal

class GraficoFluxoCaixaAnualSerie(BaseModel):
    ano: int
    fluxo_anual: Decimal
    caixa_acumulado: Decimal

class DashboardProjetoResponse(BaseModel):
    versao_id: UUID
    kpis: DashboardKPIs
    grafico_dre_por_ano: list[GraficoAnualSerie]
    grafico_fluxo_caixa_por_ano: list[GraficoFluxoCaixaAnualSerie]
```
`GET /api/v1/versoes/{versao_id}/dashboard` → `DashboardProjetoResponse`

```python
class DashboardDrillDownMensalResponse(BaseModel):
    """Drill-down opcional ao clicar em um ano nos gráficos (PRD 3.7 — não bloqueante)."""
    ano: int
    meses: list[int]
    receita_liquida_mensal: list[Decimal]
    custos_mensal: list[Decimal]
    ebitda_mensal: list[Decimal]
    fluxo_mensal: list[Decimal]
    caixa_acumulado_mensal: list[Decimal]
```
`GET /api/v1/versoes/{versao_id}/dashboard/drill-down?ano=2026` → `DashboardDrillDownMensalResponse` · `501 Not Implemented` aceitável no MVP conforme PRD 1.5/3.7 (não bloqueante).

---

## 8. Tela 7 — Cenários / What-If / Versões

### `POST /api/v1/contratos/{contrato_id}/versoes`
Permissão: Owner, Executor.

```python
class VersaoCreateRequest(BaseModel):
    nome_versao: str = Field(min_length=1, max_length=120)
    origem_versao_id: UUID | None = None   # se preenchido = "Duplicar"; se None = versão em branco

class VersaoResponse(BaseModel):
    id: UUID
    contrato_id: UUID
    nome_versao: str
    origem_versao_id: UUID | None
    criado_por: UUID
    created_at: datetime
    vinculo_precificacao_ativo: bool
```
`201 Created`

### `GET /api/v1/contratos/{contrato_id}/versoes` → `list[VersaoResponse]` (Histórico de Versões)

### `PATCH /api/v1/contratos/{contrato_id}/versoes/{versao_id}`
Permissão: Owner, Executor. Apenas `nome_versao` (Renomear).

```python
class VersaoRenameRequest(BaseModel):
    nome_versao: str = Field(min_length=1, max_length=120)
```

### `DELETE /api/v1/contratos/{contrato_id}/versoes/{versao_id}`
Permissão: Owner, Executor.

```python
class VersaoDeleteResponse(BaseModel):
    versao_id_excluida: UUID
    versao_substituta_id: UUID | None   # preenchido se a versão excluída era a ativa na navegação
```
`200 OK` · `409` (`VERSAO_UNICA_NAO_EXCLUIVEL`)

### `POST /api/v1/contratos/{contrato_id}/comparacoes`
Comparação ao vivo entre duas versões (Comparar Versões).

```python
class ComparacaoRequest(BaseModel):
    versao_a_id: UUID
    versao_b_id: UUID

class ComparacaoMetricas(BaseModel):
    receita_bruta: Decimal
    impostos: Decimal
    receita_liquida: Decimal
    custos_totais: Decimal
    ebitda: Decimal
    margem_ebitda: Decimal
    payback_mes: int | None

class ComparacaoResponse(BaseModel):
    versao_a: ComparacaoMetricas
    versao_b: ComparacaoMetricas
```
`200 OK`

### `POST /api/v1/contratos/{contrato_id}/whatif`
Simulação ao vivo — não persiste versão nova.

```python
class WhatIfRequest(BaseModel):
    versao_base_id: UUID
    ajuste_receita_pct: Decimal = Field(default=Decimal(0), decimal_places=4)
    ajuste_custo_pct: Decimal = Field(default=Decimal(0), decimal_places=4)
    ajuste_volumetria_receita_pct: Decimal = Field(default=Decimal(0), decimal_places=4)

class WhatIfResponse(BaseModel):
    versao_base: ComparacaoMetricas
    resultado_simulado: ComparacaoMetricas
    ajustes_aplicados: WhatIfRequest
```
`200 OK`

### `POST /api/v1/contratos/{contrato_id}/snapshots`
Permissão: Owner, Executor. Salva comparação ou simulação como snapshot read-only.

```python
class SnapshotCreateRequest(BaseModel):
    tipo: SnapshotTipo
    nome: str = Field(min_length=1, max_length=120)
    versao_a_id: UUID
    versao_b_id: UUID | None = None
    ajustes_whatif: WhatIfRequest | None = None
    resultado: ComparacaoResponse | WhatIfResponse

class SnapshotResponse(BaseModel):
    id: UUID
    contrato_id: UUID
    tipo: SnapshotTipo
    nome: str
    versao_a_id: UUID
    versao_b_id: UUID | None
    resultado: dict          # congelado — schema livre (JSONB), não recalculado
    created_by: UUID
    created_at: datetime
```
`201 Created`

### `GET /api/v1/contratos/{contrato_id}/snapshots` → `list[SnapshotResponse]` (aba Salvos)
### `DELETE /api/v1/contratos/{contrato_id}/snapshots/{snapshot_id}` → `204`

---

## 9. Tela 8 — Home / Dashboard da Organização

100% leitura.

```python
class HomeOrganizacaoKPIs(BaseModel):
    receita_bruta_total: Decimal
    ebitda_total: Decimal
    margem_ebitda: Decimal            # ebitda_total / receita_bruta_total — nunca média das margens individuais
    contratos_ativos_atual: int
    contratos_ativos_limite: int

class HomeOrganizacaoResponse(BaseModel):
    kpis: HomeOrganizacaoKPIs
```
`GET /api/v1/organizations/me/home` → `HomeOrganizacaoResponse`

---

## 10. Tela 9 — Configurações

### `GET /api/v1/organizations/me` / `PATCH /api/v1/organizations/me`
Permissão leitura: qualquer papel. Escrita: Owner.

```python
class OrganizationProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    document_id: str | None = None   # CNPJ

class OrganizationProfileResponse(OrganizationProfileRequest):
    id: UUID
    plan_tier: PlanTier
    subscription_status: Literal["active", "past_due", "inactive"]
```

### `GET /api/v1/users/me` / `PATCH /api/v1/users/me`
Self-service, qualquer papel edita o próprio perfil.

```python
class UserProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    theme_preference: Literal["claro", "escuro"] | None = None

class UserProfileResponse(BaseModel):
    id: UUID
    full_name: str
    avatar_url: str | None
    theme_preference: Literal["claro", "escuro"]
    role: OrganizationRole
```

### `POST /api/v1/users/me/email-change`
```python
class EmailChangeRequest(BaseModel):
    novo_email: EmailStr
```
`202 Accepted` — dispara e-mail de confirmação ao novo endereço (Supabase Auth); não altera o registro até confirmação.

### `POST /api/v1/users/me/password-change`
```python
class PasswordChangeRequest(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=8)
```
`200 OK` · `403` (senha atual incorreta)

### Gestão de Usuários (Owner-only)

```python
class InviteCreateRequest(BaseModel):
    email: EmailStr
    role: Literal["executor", "viewer"]

class InviteResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: Literal["executor", "viewer"]
    status: Literal["pendente", "aceito", "expirado", "cancelado"]
    created_at: datetime
    expires_at: datetime

class MemberRoleUpdateRequest(BaseModel):
    role: Literal["executor", "viewer"]

class OrganizationMemberResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: EmailStr
    role: OrganizationRole
    joined_at: datetime
```
- `POST /api/v1/organizations/me/invites` → `InviteResponse` `201` · `403` (`LIMITE_PLANO_EXCEDIDO` se não houver vaga)
- `GET /api/v1/organizations/me/invites` → `list[InviteResponse]`
- `DELETE /api/v1/organizations/me/invites/{invite_id}` → `204` (cancelar convite pendente)
- `GET /api/v1/organizations/me/members` → `list[OrganizationMemberResponse]`
- `PATCH /api/v1/organizations/me/members/{user_id}` → `OrganizationMemberResponse` (trocar papel)
- `DELETE /api/v1/organizations/me/members/{user_id}` → `204` (remover usuário)

Todas as rotas de Gestão de Usuários e `GET/PATCH /api/v1/organizations/me` (exceto leitura) retornam `403` para papéis Executor/Viewer, mesmo com token válido — reforçado no backend, não apenas ocultado no frontend (PRD 5.1).

---

## 11. Tela 10 — Login / Esqueci Senha / Aceite de Convite

Autenticação delegada ao Supabase Auth SDK diretamente do frontend na maior parte do fluxo (login, refresh, logout). O FastAPI expõe apenas o que exige lógica de negócio própria do Prumo:

### `GET /api/v1/invites/{token}`
Rota pública (sem JWT) — resolve convite por token para pré-preencher o formulário de aceite.

```python
class InvitePreviewResponse(BaseModel):
    email: EmailStr
    role: Literal["executor", "viewer"]
    organization_name: str
    status: Literal["pendente", "aceito", "expirado", "cancelado"]
```
`200 OK` · `404` (token inválido) — mensagem genérica, sem detalhar motivo (não-enumeração).

### `POST /api/v1/invites/{token}/accept`
Rota pública (sem JWT prévio — cria a conta/vincula no mesmo passo via Supabase Admin API).

```python
class InviteAcceptRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8)

class InviteAcceptResponse(BaseModel):
    user_id: UUID
    organization_id: UUID
    role: Literal["executor", "viewer"]
    access_token: str
    refresh_token: str
```
`200 OK` · `409` (token já usado/expirado) — este é o gatilho exato que muda o convite de `pendente` para `aceito` e passa a contar no limite de Usuários (PRD 3.11, US-K3).

---

## 12. Resumo de Enforcement por Papel (referência cruzada rápida)

| Ação | Owner | Executor | Viewer |
|---|---|---|---|
| CRUD de `contratos` (exceto DELETE) | ✅ | ✅ | ❌ |
| DELETE `contratos` | ✅ | ❌ | ❌ |
| CRUD `versoes`, linhas, cronograma, snapshots | ✅ | ✅ | ❌ |
| Leitura de todas as telas (inclusive DRE/Fluxo/Dashboard/Home) | ✅ | ✅ | ✅ |
| Exportação | ✅ | ✅ | ✅ |
| Gestão de Usuários / Plano Atual | ✅ | ❌ | ❌ |
| Perfil próprio (Tela 9, seção 3) | ✅ | ✅ | ✅ |

---

*Contrato gerado pelo Agente Atlas (Arquiteto) a partir de `docs/prd/prd-viabilidade.md` — pronto para handoff ao Agente Kaiser (Backend) para implementação das rotas em FastAPI, e ao Agente Sentinel (QA) para validação de RLS e testes matemáticos.*
