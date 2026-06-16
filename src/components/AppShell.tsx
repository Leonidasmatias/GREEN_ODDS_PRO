import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CreatorSignature } from "./CreatorSignature";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><Sidebar/><div className="pb-24 lg:ml-[272px] lg:pb-0">
    <Header/>
    <main className="relative mx-auto max-w-[1680px] p-4 md:p-7">{children}</main>
    <footer className="border-t border-line px-6 py-6">
      <div className="mx-auto max-w-4xl"><CreatorSignature compact/></div>
      <p className="mt-4 text-center text-[11px] text-zinc-600">As analises sao estatisticas e nao garantem lucro. Aposte com responsabilidade.</p>
    </footer>
  </div></div>;
}
