import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const APP_PATH = "/";

function redirectPreservingCookies(request: NextRequest, path: string, refreshed: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  const redirect = NextResponse.redirect(url);
  refreshed.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
  return redirect;
}

export async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: items => { items.forEach(({name,value})=>request.cookies.set(name,value)); response=NextResponse.next({request}); items.forEach(({name,value,options})=>response.cookies.set(name,value,options)); } } });
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && pathname === APP_PATH) return redirectPreservingCookies(request, LOGIN_PATH, response);
  if (user && pathname === LOGIN_PATH) return redirectPreservingCookies(request, APP_PATH, response);

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
