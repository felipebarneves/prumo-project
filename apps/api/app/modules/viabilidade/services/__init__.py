"""Lógica pura de cálculo financeiro do módulo Viabilidade — desacoplada de rotas/HTTP.

- decimal_utils: precisão e arredondamento (Decimal, nunca float).
- models: dataclasses de domínio consumidos pelo motor.
- cronograma_engine: distribuição temporal de volumetria (Tela 3).
- motor: DRE + Fluxo de Caixa em passada única sequencial (Telas 4 e 5).
- kpi_engine: VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro (Telas 5 e 6).
- metricas: métricas resumidas para comparação de versões (Tela 7).
- whatif_engine: simulação paramétrica reutilizando o motor completo (Tela 7).
"""
