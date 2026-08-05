from app.modules.viabilidade.repository import _escapar_valor_postgrest


def test_escapa_virgula_para_impedir_condicao_or_extra():
    resultado = _escapar_valor_postgrest("x,status_ciclo_vida.eq.cancelado")
    assert resultado == "x\\,status_ciclo_vida.eq.cancelado"


def test_escapa_parenteses():
    assert _escapar_valor_postgrest("a(b)c") == "a\\(b\\)c"


def test_escapa_barra_invertida_antes_dos_demais_caracteres():
    assert _escapar_valor_postgrest("a\\,b") == "a\\\\\\,b"


def test_texto_sem_caracteres_especiais_permanece_igual():
    assert _escapar_valor_postgrest("Construtora Alfa") == "Construtora Alfa"
