export const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

export const errorResponse = (
  code: string,
  message: string,
  details?: unknown,
  status = 400,
) =>
  jsonResponse(
    {
      error: {
        code,
        message,
        details,
      },
    },
    status,
  );
