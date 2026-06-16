import { NextResponse } from "next/server";
import { getLiveMonitor } from "@/services/liveDataService";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(await getLiveMonitor());}
