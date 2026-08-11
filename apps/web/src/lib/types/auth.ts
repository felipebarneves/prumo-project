/** Tipos espelhando apps/api/app/api/routes/auth.py (identidade cross-cutting, fora do módulo Viabilidade). */

export interface Me {
  full_name: string;
  email: string;
  organization_name: string;
  role: string;
}

export interface MeUpdatePayload {
  full_name?: string | null;
  current_password?: string | null;
  new_password?: string | null;
  confirm_password?: string | null;
}
