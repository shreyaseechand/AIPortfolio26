// Vercel Edge Middleware — runs on every request BEFORE any file is served.
// Unauthenticated visitors never receive the protected HTML at all, so the
// password can't be found by "View Source" the way a client-side gate can.
//
// Environment Variables (set in the Vercel dashboard):
//   PASSWORD_PROTECTION – set to "on" to enable the gate. If unset/anything
//                         else, the whole site is OPEN (used while verifying
//                         the Vercel migration before turning protection on).
//   SITE_PASSWORD       – the password visitors type (needed only when "on")
//   SITE_AUTH_TOKEN     – a long random string stored in the cookie ("on")

// The gate page + the specific assets it needs are always reachable, even
// while locked. Everything else requires a valid session cookie.
const PUBLIC_PATHS = new Set([
  "/password.html",
  "/scan.js",
  "/favicon.ico",
  "/assets/img/favicon-32.png",
  "/assets/img/favicon-192.png",
  "/assets/img/apple-touch-icon.png",
]);

function isAuthed(request) {
  const token = process.env.SITE_AUTH_TOKEN;
  if (!token) return false;
  const cookie = request.headers.get("cookie") || "";
  const entry = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sc_auth="));
  return !!entry && entry.slice("sc_auth=".length) === token;
}

export default function middleware(request) {
  // Gate is OFF unless explicitly enabled — keeps the site open while we
  // confirm the GitHub → Vercel move works. Flip PASSWORD_PROTECTION="on".
  if (process.env.PASSWORD_PROTECTION !== "on") return;

  const { pathname } = new URL(request.url);

  // Always allow the gate itself, its assets, and the login endpoint.
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/")) return;

  // Authenticated → let the request through to the static file.
  if (isAuthed(request)) return;

  // Locked → send to the gate, remembering the originally requested page.
  const url = new URL("/password.html", request.url);
  if (pathname !== "/") url.searchParams.set("from", pathname);
  return Response.redirect(url, 302);
}

export const config = {
  // Run on everything except Vercel internals.
  matcher: "/((?!_vercel|_next).*)",
};
