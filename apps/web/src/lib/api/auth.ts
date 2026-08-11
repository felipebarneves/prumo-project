/**
 * Cliente de integração HTTP para identidade do usuário autenticado — cross-cutting
 * (não pertence ao módulo Viabilidade). Endpoints em apps/api/app/api/routes/auth.py.
 */
import { apiRequest } from "./client";
import type { Me, MeUpdatePayload } from "@/lib/types/auth";

export const authApi = {
  obterMeuPerfil: () => apiRequest<Me>("/api/v1/auth/me"),

  atualizarMeuPerfil: (payload: MeUpdatePayload) =>
    apiRequest<Me>("/api/v1/auth/me", { method: "PUT", body: payload }),
};
