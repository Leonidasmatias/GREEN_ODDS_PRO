import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return <main className="py-10"><AuthForm mode="login"/><p className="mt-5 text-center text-xs text-zinc-500">Ainda nao tem conta? <Link href="/register" className="text-neon">Criar cadastro</Link></p><p className="mt-2 text-center text-xs text-zinc-600"><Link href="/risk-disclaimer">Leia o aviso de risco</Link></p></main>;
}
