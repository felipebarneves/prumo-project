import { createClient } from "@/lib/supabase";
import type { ErrorResponseBody } from "@/lib/types/viabilidade";

const FALLBACK_API_BASE_URL = "http://localhost:8000";

/**
 * Resolve `NEXT_PUBLIC_API_URL` para uma base de URL sempre absoluta e sem
 * barra final — `new URL(base + path)` lança "Invalid URL" (não um erro de
 * rede, indistinguível de uma falha de conexão) sempre que a env var vem
 * ausente, vazia, sem protocolo (ex: "api.prumo.com") ou com barra dupla.
 */
function resolveApiBaseUrl(raw: string | undefined): string {
  const semBarraFinal = raw?.trim().replace(/\/+$/, "");

  if (!semBarraFinal) {
    console.warn(
      `[apiRequest] NEXT_PUBLIC_API_URL ausente — usando fallback "${FALLBACK_API_BASE_URL}".`
    );
    return FALLBACK_API_BASE_URL;
  }

  if (/^https?:\/\//i.test(semBarraFinal)) {
    return semBarraFinal;
  }

  // Sem protocolo, "new URL" trata a string toda como path relativo e quebra
  // — assume http:// para hosts locais (dev) e https:// para qualquer outro
  // domínio (produção nunca deveria servir a API em texto claro).
  const protocolo = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(semBarraFinal) ? "http" : "https";
  const comProtocolo = `${protocolo}://${semBarraFinal}`;
  console.warn(`[apiRequest] NEXT_PUBLIC_API_URL="${raw}" sem protocolo — normalizado para "${comProtocolo}".`);
  return comProtocolo;
}

const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export class ApiError extends Error {
  readonly errorCode: string;
  readonly status: number;
  readonly details?: Record<string, unknown> | null;

  constructor(status: number, body: ErrorResponseBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = body.error_code;
    this.details = body.details ?? null;
  }
}

/** Pydantic/FastAPI validation error item — formato bruto de um 422 de validação
 * de request (não passou pelas rotas do Kaiser, foi rejeitado antes disso pelo
 * FastAPI). Formato diferente do `{error_code, message}` usado no restante da API. */
interface PydanticValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

function isPydanticValidationErrorList(detail: unknown): detail is PydanticValidationErrorItem[] {
  return (
    Array.isArray(detail) &&
    detail.every((item) => item && typeof item === "object" && "msg" in item && "loc" in item)
  );
}

function extrairErrorBody(status: number, payload: unknown): ErrorResponseBody {
  const detail = (payload as { detail?: unknown } | null)?.detail;

  if (isPydanticValidationErrorList(detail)) {
    // Sem isso, `new ApiError(status, { message: undefined, ... })` produz um
    // err.message vazio — o toast final ficava em branco justamente no caso
    // mais comum de erro de formulário (campo obrigatório, tipo errado, `ge=1`
    // violado etc.), que é exatamente quando o usuário mais precisa da mensagem.
    const mensagem = detail
      .map((item) => {
        const campo = item.loc.slice(1).join(".") || item.loc.join(".");
        return campo ? `${campo}: ${item.msg}` : item.msg;
      })
      .join(" | ");
    return { error_code: "ERRO_VALIDACAO", message: mensagem };
  }

  if (detail && typeof detail === "object" && "message" in detail) {
    return detail as ErrorResponseBody;
  }

  return {
    error_code: "ERRO_DESCONHECIDO",
    message: `Erro inesperado (HTTP ${status}). Tente novamente.`,
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, unknown>;
}

/** Junta base + path sem produzir "//" (fora do "://" do protocolo) nem path
 * relativo quebrado — `path` sempre deve chegar como "/api/v1/..." dos módulos
 * de api/*, mas normaliza mesmo assim para não depender só dessa convenção. */
function montarUrl(base: string, path: string): URL {
  const pathSanitizado = `/${path.replace(/^\/+/, "")}`;
  try {
    return new URL(`${base}${pathSanitizado}`);
  } catch (err) {
    // "Invalid URL" nativo não diz QUAL string falhou — sem isso, esse erro
    // é indistinguível de uma falha de rede no restante do apiRequest.
    console.error("[apiRequest] Falha ao montar URL da requisição", { base, path, pathSanitizado, err });
    throw new Error(`URL da API inválida (base="${base}", path="${path}").`);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, searchParams } = options;

  const url = montarUrl(API_BASE_URL, path);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    // Sem isso, a requisição seguia sem Authorization e só falhava lá na frente
    // com um 401 genérico do backend — o usuário via "sessão expirada" sem
    // nenhuma pista de que a causa era um token ausente no client, e podia ficar
    // preso na tela em vez de ser levado de volta ao login.
    console.error("[apiRequest] Token Supabase ausente/sessão inválida — requisição abortada antes do fetch.", {
      method,
      url: url.toString(),
    });
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sessão expirada ou ausente. Faça login novamente.");
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    console.error("[apiRequest] Falha de rede ao chamar a API", {
      method,
      url: url.toString(),
      body,
      error: networkError,
    });
    throw networkError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = extrairErrorBody(response.status, payload);
    // Loga o payload exato enviado e a resposta exata recebida do backend —
    // sem isso, o toast genérico exibido ao usuário é a única pista disponível
    // para depurar uma falha de gravação/leitura (ex: RLS, org_id ausente).
    console.error("[apiRequest] Requisição falhou", {
      method,
      url: url.toString(),
      requestBody: body,
      status: response.status,
      responseBody: payload,
    });
    throw new ApiError(response.status, errorBody);
  }

  return payload as T;
}
