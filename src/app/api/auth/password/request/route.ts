import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const user = email ? await prisma.user.findUnique({ where: { email } }).catch(() => null) : null;
  if (user) {
    const raw = randomBytes(32).toString("hex");
    const token = createHash("sha256").update(raw).digest("hex");
    await prisma.verificationToken.create({
      data: { identifier: `password-reset:${email}`, token, expires: new Date(Date.now() + 30 * 60 * 1000) },
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, message: "Se o e-mail existir, uma recuperacao sera preparada. Envio de e-mail fica para a proxima etapa comercial." });
}
