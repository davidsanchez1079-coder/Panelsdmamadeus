import { NextResponse } from 'next/server';

import { formatErrorMessage } from '@/lib/formatErrorMessage';
import { getSupabaseAdmin, isSupabasePersistenceConfigured, resolveSupabaseUrl } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * Diagnóstico sin exponer secretos: abre en el navegador `/api/capture/supabase-health`
 * para ver si el servidor llega a Supabase y a la tabla `panelsdm_state`.
 */
export async function GET() {
  const url = resolveSupabaseUrl();
  const hasKey = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
  const configured = isSupabasePersistenceConfigured();

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        step: 'env',
        hint:
          'En Vercel → Settings → Environment Variables: SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL (solo https://xxx.supabase.co) y SUPABASE_SERVICE_ROLE_KEY. Luego Redeploy.',
        hasUrl: Boolean(url),
        hasServiceRoleKey: hasKey,
      },
      { headers: noStore },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('panelsdm_state').select('id').limit(1);
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: 'query',
          message: formatErrorMessage(error),
        },
        { headers: noStore },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        step: 'query',
        message: 'Conexión correcta: tabla `panelsdm_state` accesible con service role.',
      },
      { headers: noStore },
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        step: 'client',
        message: formatErrorMessage(e),
      },
      { headers: noStore },
    );
  }
}
