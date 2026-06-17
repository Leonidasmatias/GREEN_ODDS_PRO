"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return <button onClick={logout} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white">Sair</button>;
}
