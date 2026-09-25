import { NextResponse, type NextRequest } from "next/server";
import { isNetworkKey, NETWORK_COOKIE } from "./lib/networks";

// `?network=<key>` (e.g. from the old robinhood.regenbazaar.com redirect or a shared link) selects the network
// once: store it in the cookie and drop the parameter from the URL.
export function middleware(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("network");
  if (!key) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.searchParams.delete("network");
  const res = NextResponse.redirect(url);
  if (isNetworkKey(key)) {
    res.cookies.set(NETWORK_COOKIE, key, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}

export const config = { matcher: ["/((?!api|_next|favicon).*)"] };
