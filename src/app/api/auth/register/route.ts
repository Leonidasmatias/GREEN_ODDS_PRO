import { NextResponse } from "next/server";
import { registerUser } from "@/services/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await registerUser({ name: body.name, email: body.email, password: body.password });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "REGISTER_FAILED" }, { status: 400 });
  }
}
