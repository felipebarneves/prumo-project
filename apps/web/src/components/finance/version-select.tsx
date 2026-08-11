import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Versao } from "@/lib/types/viabilidade";

/** Nome + badge de status da versão, usado nos itens dos dropdowns de seleção. */
function VersionOptionLabel({ versao, versaoAtualId }: { versao: Versao; versaoAtualId: string }) {
  return (
    <span className="flex items-center gap-2">
      <span>{versao.nome_versao}</span>
      {versao.id === versaoAtualId ? (
        <Badge variant="secondary">Ativo</Badge>
      ) : versao.vinculo_precificacao_ativo ? (
        <Badge variant="outline">Vinculada</Badge>
      ) : null}
    </span>
  );
}

interface VersionSelectProps {
  versoes: Versao[] | null | undefined;
  versaoAtualId: string;
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}

/**
 * Select de versão padronizado — sempre exibe o nome da versão (`nome_versao`) mais o
 * badge de status, nunca o UUID bruto. Enquanto a versão selecionada ainda não foi
 * encontrada na lista (carregando), cai para o placeholder em vez do id.
 */
export function VersionSelect({ versoes, versaoAtualId, value, onChange, placeholder }: VersionSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder={placeholder}>
          {(id: string | null) => {
            const versao = id ? versoes?.find((v) => v.id === id) : undefined;
            return versao ? <VersionOptionLabel versao={versao} versaoAtualId={versaoAtualId} /> : "";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {versoes?.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            <VersionOptionLabel versao={v} versaoAtualId={versaoAtualId} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
