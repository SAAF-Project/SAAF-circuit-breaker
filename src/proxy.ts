import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
export function proxy(request: NextRequest) {
  const denied = authorizeRequest(request);
  if (denied) return denied;
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/:path*"] };
