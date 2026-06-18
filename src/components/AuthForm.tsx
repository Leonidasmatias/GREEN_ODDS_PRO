"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        setError(data.error ?? "AUTH_REQUEST_FAILED");
        return;
      }
      setMessage(mode === "login" ? data.message ?? "LOGIN_SUCCESS" : "CONTA_CRIADA");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 250);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AUTH_REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={submit} className="card mx-auto max-w-md p-6">
    <p className="label text-neon">{mode === "login" ? "Entrar" : "Criar conta"}</p>
    <h1 className="mt-2 text-2xl font-black">{mode === "login" ? "Acesse sua conta" : "Comece no plano FREE"}</h1>
    {mode === "register" && <label className="mt-5 block text-xs font-bold text-zinc-400">Nome<input name="name" className="mt-2 w-full rounded-xl border border-line bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-neon" /></label>}
    <label className="mt-5 block text-xs font-bold text-zinc-400">E-mail<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-line bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-neon" /></label>
    <label className="mt-4 block text-xs font-bold text-zinc-400">Senha<input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-xl border border-line bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-neon" /></label>
    {message && <p className="mt-4 rounded-xl border border-neon/20 bg-neon/[.06] p-3 text-xs font-black text-neon">{message}</p>}
    {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.06] p-3 text-xs font-black text-red-300">{error}</p>}
    <button disabled={loading} aria-busy={loading} className="mt-6 w-full rounded-xl bg-neon px-5 py-3 text-xs font-black uppercase text-[#041008] disabled:cursor-wait disabled:opacity-60">{loading ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
  </form>;
}
