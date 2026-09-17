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

  let user = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    // In Docker containers, public domain DNS / hairpin NAT may fail for internal container fetch
  }

  // Fallback: If remote network check failed, inspect the local session cookie
  if (!user) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && session.expires_at && session.expires_at * 1000 > Date.now()) {
        user = session.user;
      }
    } catch {
      // ignore
    }
  }

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