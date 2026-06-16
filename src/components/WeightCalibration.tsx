"use client";

import { useEffect, useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { defaultModelWeights, type ModelWeights } from "@/lib/backtestEngine";

const labels: Record<keyof ModelWeights, string> = { form: "Forma", attack: "Ataque", defense: "Defesa", momentum: "Momento", ranking: "Ranking", statistics: "Estatísticas" };

export function WeightCalibration() {
  const [weights, setWeights] = useState<ModelWeights>(defaultModelWeights);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { fetch("/api/model-weights", { cache: "no-store" }).then((response) => response.json()).then((data) => setWeights({ form: data.form, attack: data.attack, defense: data.defense, momentum: data.momentum, ranking: data.ranking, statistics: data.statistics })).catch(() => setMessage("Pesos padrão ativos.")); }, []);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  async function save() {
    const response = await fetch("/api/model-weights", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(weights) });
    setMessage(response.ok ? "Pesos salvos no banco." : "Não foi possível salvar os pesos.");
  }

  return <section className="card p-5 md:p-6"><div className="flex items-start justify-between"><div><p className="label text-neon">Calibração</p><h2 className="mt-2 text-lg font-black">Pesos do modelo</h2><p className="mt-1 text-[10px] text-zinc-600">Total atual: {total}% · os pesos são normalizados no cálculo</p></div><SlidersHorizontal className="text-neon" size={19}/></div><div className="mt-6 grid gap-4 md:grid-cols-2">{(Object.keys(weights) as Array<keyof ModelWeights>).map((key) => <label key={key} className="block"><div className="mb-2 flex justify-between text-[10px]"><span className="font-bold text-zinc-400">{labels[key]}</span><strong className="text-gold">{weights[key]}%</strong></div><input className="h-1.5 w-full accent-[#45e68a]" type="range" min="0" max="40" step="1" value={weights[key]} onChange={(event) => setWeights((current) => ({...current, [key]: Number(event.target.value)}))}/></label>)}</div><div className="mt-6 flex items-center justify-between border-t border-line pt-4"><span className="text-[10px] text-zinc-500">{message ?? "Ajustes afetam novas análises após integração completa."}</span><button onClick={save} className="flex items-center gap-2 rounded-xl bg-neon px-4 py-3 text-[10px] font-black uppercase text-black"><Save size={14}/> Salvar pesos</button></div></section>;
}
