import { NextResponse } from "next/server";
import { logoutUser } from "@/services/authService";

export async function POST() {
  await logoutUser();
  return NextResponse.json({ ok: true });
}
