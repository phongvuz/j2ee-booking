import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";

// CORS is closed by default: the application does not authorize another origin
// to read its APIs. Reject preflights and mutations before reaching a handler;
// each protected handler still performs its own authentication/authorization.
export function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Nguồn yêu cầu không hợp lệ." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
