"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface PerformancePoint {
  date: string;
  profit: number;
  roi: number;
  greens: number;
  reds: number;
}

const tooltipStyle = { background: "#101613", border: "1px solid #243029", borderRadius: 12, color: "#fff", fontSize: 11 };

export function PerformanceCharts({ data }: { data: PerformancePoint[] }) {
  return <div className="grid gap-6 xl:grid-cols-2">
    <section className="card min-w-0 p-5 md:p-6"><div className="mb-6"><p className="text-sm font-black uppercase tracking-wider">Lucro acumulado</p><p className="mt-1 text-[10px] text-zinc-600">Evolução simulada em unidades</p></div><div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width: 560, height: 288}}><AreaChart data={data}><defs><linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#45e68a" stopOpacity={0.34}/><stop offset="95%" stopColor="#45e68a" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#243029" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" stroke="#59635d" tick={{fontSize:9}}/><YAxis stroke="#59635d" tick={{fontSize:9}} unit="u"/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="profit" stroke="#45e68a" strokeWidth={2.5} fill="url(#profitGradient)" name="Lucro"/></AreaChart></ResponsiveContainer></div></section>
    <section className="card min-w-0 p-5 md:p-6"><div className="mb-6"><p className="text-sm font-black uppercase tracking-wider">Greens x Reds</p><p className="mt-1 text-[10px] text-zinc-600">Resultados acumulados por período</p></div><div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width: 560, height: 288}}><BarChart data={data}><CartesianGrid stroke="#243029" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" stroke="#59635d" tick={{fontSize:9}}/><YAxis stroke="#59635d" tick={{fontSize:9}}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="greens" fill="#45e68a" radius={[4,4,0,0]} name="Greens"/><Bar dataKey="reds" fill="#ef5b65" radius={[4,4,0,0]} name="Reds"/></BarChart></ResponsiveContainer></div></section>
  </div>;
}
