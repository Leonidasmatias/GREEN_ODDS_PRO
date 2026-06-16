import { NextResponse } from "next/server";
import { getAdminOverview } from "@/services/goLiveService";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(await getAdminOverview());}
