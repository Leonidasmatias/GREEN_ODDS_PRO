import { NextResponse } from "next/server";
import { loginUser } from "@/services/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await loginUser({ email: body.email, password: body.password });
    return NextResponse.json({ ok: true, message: "LOGIN_SUCCESS" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_CREDENTIALS";
    const status = code === "USER_NOT_FOUND" ? 404 : code === "ACCOUNT_INACTIVE" ? 403 : 401;
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
