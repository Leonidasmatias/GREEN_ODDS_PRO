import { requireAuth } from "@/services/authService";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ProfilePage() {
  const context = await requireAuth();
  return <main className="mx-auto max-w-2xl py-10"><section className="card p-6"><p className="label text-neon">Perfil</p><h1 className="mt-2 text-2xl font-black">{context.user.name ?? context.user.email}</h1><p className="mt-2 text-sm text-zinc-500">{context.user.email}</p><p className="mt-5 text-xs text-zinc-500">Plano ativo: <b className="text-white">{context.plan?.code ?? "SEM PLANO"}</b></p><div className="mt-6"><LogoutButton/></div></section></main>;
}
