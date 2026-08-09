import { type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware'; // We will create this helper file next

export async function middleware(request: NextRequest) {
  // updateSession will take care of refreshing the session cookie
  // and handling redirects. It will return the final response object.
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/health (container healthcheck — must return 200 JSON, not an
     *   auth redirect; it exposes no data beyond a liveness flag)
     * This ensures the middleware runs on all pages and API routes
     * but ignores static assets for performance.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
};