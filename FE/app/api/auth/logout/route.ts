import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, message: "Nguồn yêu cầu không hợp lệ!" }, { status: 403 });
  const audience = new URL(request.url).searchParams.get("audience") ?? "customer";
  if (audience !== "admin" && audience !== "customer") {
    return NextResponse.json({ success: false, message: "Loại phiên đăng xuất không hợp lệ!" }, { status: 400 });
  }
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(audience === "admin" ? ADMIN_SESSION_COOKIE : SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
