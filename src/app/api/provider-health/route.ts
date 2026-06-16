import { NextResponse } from "next/server";
import { getProviderHealth } from "@/providers/providerManager";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({providers:await getProviderHealth(),checkedAt:new Date().toISOString()});}
