// src/app/api/team/create-user/route.ts
// Server-side API route to create users without email verification.
// Uses the service_role key (server-only, never exposed to the client).

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, role, organization_id } = body;

    // Validate required fields
    if (!email || !password || !organization_id) {
      return NextResponse.json(
        { error: 'Email, password, and organization_id are required.' },
        { status: 400 }
      );
    }

    // Create admin client with service_role key (server-side only)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller is an admin by checking authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create users.' }, { status: 403 });
    }

    // Verify caller belongs to the same organization
    if (callerProfile.organization_id !== organization_id) {
      return NextResponse.json({ error: 'Organization mismatch.' }, { status: 403 });
    }

    // Create the user — no email verification
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark email as already confirmed
      user_metadata: {
        organization_id,
        role: role || 'agent',
        full_name: full_name || '',
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
