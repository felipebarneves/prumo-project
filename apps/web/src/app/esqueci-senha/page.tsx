"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase";

/**
 * Tela 10 — Esqueci a Senha (etapa 1: solicitar). PRD 04-auth-integrations.md:
 * a mensagem de confirmação é sempre a mesma, exista ou não conta associada ao
 * e-mail informado — não-enumeração de e-mails cadastrados (mesma regra do Login).
 */
export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      // Nunca exposto ao usuário — logado apenas para investigação, a mensagem
      // de tela permanece idêntica ao caminho de sucesso (não-enumeração).
      console.error("Falha ao solicitar redefinição de senha:", error);
    }

    setEnviando(false);
    setEnviado(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="font-[var(--font-display)] text-sm font-bold text-foreground">Prumo</p>
          <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
          <CardDescription>Informe seu e-mail para receber o link de redefinição.</CardDescription>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Se este e-mail estiver cadastrado, você receberá um link de redefinição em instantes.
              </p>
              <Link href="/login" className="text-sm text-primary hover:underline">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar link de redefinição"}
              </Button>

              <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-primary hover:underline">
                Voltar para o login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
