import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Check the current authentication state.
  const { data } = await supabase.auth.getClaims();

  const claims = data?.claims ?? null;

  const pathname = request.nextUrl.pathname;

  // Pages that require the user to be logged in.
  const protectedRoutes = [
    "/create",
    "/accounts",
    "/calendar",
    "/content",
    "/settings",
  ];

  // Pages available when logged out.
  const authRoutes = ["/login", "/signup"];

  const isProtectedRoute = protectedRoutes.some(
    (route) =>
      pathname === route || pathname.startsWith(`${route}/`)
  );

  const isAuthRoute = authRoutes.some(
    (route) =>
      pathname === route || pathname.startsWith(`${route}/`)
  );

  // ---------------------------------------------------------
  // NOT LOGGED IN
  // Protected page → redirect to clean /login URL
  // ---------------------------------------------------------
  if (!claims && isProtectedRoute) {
    const url = request.nextUrl.clone();

    url.pathname = "/login";
    url.search = "";

    return NextResponse.redirect(url);
  }

  // ---------------------------------------------------------
  // LOGGED IN
  // Don't allow logged-in users to stay on login/signup.
  // ---------------------------------------------------------
  if (claims && isAuthRoute) {
    const url = request.nextUrl.clone();

    url.pathname = "/";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};