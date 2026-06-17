import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return <main className="py-10"><AuthForm mode="register"/><p className="mt-5 text-center text-xs text-zinc-500">Ja tem conta? <Link href="/login" className="text-neon">Entrar</Link></p></main>;
}
