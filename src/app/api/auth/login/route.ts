import { NextResponse } from "next/server";
import { loginUser } from "@/services/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await loginUser({ email: body.email, password: body.password });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
}
