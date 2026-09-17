import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This will refresh the user's session if it's expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Helper to preserve refreshed cookies across redirect responses
  const createRedirectWithCookies = (destinationUrl: URL) => {
    const redirectResponse = NextResponse.redirect(destinationUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  // If the user is not logged in and is trying to access any protected page,
  // redirect them to the login page.
  if (!user && !pathname.startsWith('/login')) {
    return createRedirectWithCookies(new URL('/login', request.url));
  }

  // If the user IS logged in and is trying to access the login page,
  // redirect them to the home page.
  if (user && pathname.startsWith('/login')) {
    return createRedirectWithCookies(new URL('/', request.url));
  }

  return response;
}