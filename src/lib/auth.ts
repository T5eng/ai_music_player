import { NextRequest } from "next/server";

export function getAdminSecret(): string | null {
  return process.env.ADMIN_SECRET || null;
}

export function isAdminEnabled(): boolean {
  return Boolean(getAdminSecret());
}

export function verifyAdmin(req: NextRequest): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;

  const header = req.headers.get("x-admin-secret");
  const query = req.nextUrl.searchParams.get("token");
  return header === secret || query === secret;
}

export function unauthorizedResponse() {
  return Response.json({ error: "未授权，请提供正确的管理密钥" }, { status: 401 });
}
