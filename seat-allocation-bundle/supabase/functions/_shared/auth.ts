import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.50.1';
import { errorResponse } from './http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY env vars.');
}

export const createUserClient = (req: Request): SupabaseClient =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

export const createServiceClient = (): SupabaseClient =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

export const requireUser = async (req: Request) => {
  const client = createUserClient(req);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return {
      error: errorResponse('UNAUTHORIZED', 'Valid authenticated session is required.', error?.message, 401),
      user: null,
      client,
    };
  }

  return {
    error: null,
    user,
    client,
  };
};
