import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // A request cookie can't be set, so we store the refresh token
          // in a temporary cookie that will be consumed by the server client
          // in the next request.
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // A request cookie can't be removed, so we set it to an empty value
          // with an expired date.
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // This will refresh the user's session if it's expired.
  // It's the most important part of the middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Custom redirect logic for your application ---
  const { pathname } = request.nextUrl;

  // If the user is not logged in and is trying to access any protected page,
  // redirect them to the login page.
  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If the user IS logged in and is trying to access the login page,
  // redirect them to the home page.
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  // --- End of custom logic ---


  // If no redirects are needed, return the original response,
  // which now has the refreshed auth cookie attached.
  return response;
}