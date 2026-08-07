/**
 * A navegação entre abas (Parâmetros/Cronograma/DRE/...) e o seletor de versão
 * viveram aqui antes de virarem, respectivamente, a Sidebar e o Header globais
 * do módulo (ver components/layout/). Este layout permanece só como ponto de
 * extensão para o segmento de rota — sem markup próprio, para não duplicar UI.
 */
export default function VersaoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
