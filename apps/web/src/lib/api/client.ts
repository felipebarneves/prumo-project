import { createClient } from "@/lib/supabase";
import type { ErrorResponseBody } from "@/lib/types/viabilidade";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, unknown>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, searchParams } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    ...(await authHeader()),
  };
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
    const errorBody: ErrorResponseBody = payload?.detail ?? {
      error_code: "ERRO_DESCONHECIDO",
      message: "Ocorreu um erro inesperado. Tente novamente.",
    };
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
