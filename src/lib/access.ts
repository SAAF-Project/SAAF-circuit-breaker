import { createHash, timingSafeEqual } from "node:crypto";
/** One deployment = one trusted operator. Not a tenant isolation mechanism. */
export function authorizeRequest(request: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const password = env.SAAF_OPERATOR_PASSWORD;
  const username = env.SAAF_OPERATOR_USER || "operator";
  const configured = Boolean(password && password.length >= 24 && !username.includes(":"));
  if (!configured) {
    if (env.NODE_ENV === "production" || password) return Response.json({ error: "Operator authentication is not configured" }, { status: 503 });
    // Local development only. Never use next dev as a public deployment.
    return null;
  }
  const digest = (text: string) => createHash("sha256").update(text).digest();
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  if (!timingSafeEqual(digest(request.headers.get("authorization") || ""), digest(expected))) {
    return new Response("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="SAAF operator", charset="UTF-8"', "Cache-Control": "no-store" } });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
      return Response.json({ error: "Cross-origin mutation denied" }, { status: 403 });
    }
  }
  return null;
}
