import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/authService";

export async function GET() {
  const context = await getCurrentUser();
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: { id: context.user.id, name: context.user.name, email: context.user.email },
    plan: context.plan ? { code: context.plan.code, name: context.plan.name } : null,
  });
}
