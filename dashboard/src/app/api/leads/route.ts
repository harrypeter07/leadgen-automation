// dashboard/src/app/api/leads/route.ts
import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/api/handler';
import { ok, fail } from '@/server/api/response';
import { LeadRepository } from '@/modules/leads/repositories/lead-repository';
import { supabaseAdmin } from '@/lib/supabase';

export const GET = withApiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || searchParams.get('perPage') || '25');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const city = searchParams.get('city') || '';
  const category = searchParams.get('category') || '';

  const { leads, total } = await LeadRepository.findLeads({
    page,
    limit,
    search,
    status,
    city,
    category,
  });

  return ok({ leads, total });
});

export const POST = withApiHandler(async (req: Request) => {
  const payload = await req.json();

  if (Array.isArray(payload)) {
    const invalid = payload.some(item => !item.id);
    if (invalid) return fail('lead ID required for each item in batch', 'VALIDATION_ERROR', 400);

    const { error } = await supabaseAdmin.from('leads').upsert(payload, { onConflict: 'id' });
    if (error) return fail(error.message, 'DATABASE_ERROR', 500);

    return ok({ message: 'Leads updated successfully' });
  } else {
    if (!payload.id) return fail('lead ID required for update', 'VALIDATION_ERROR', 400);

    const { error } = await supabaseAdmin.from('leads').upsert(payload, { onConflict: 'id' });
    if (error) return fail(error.message, 'DATABASE_ERROR', 500);

    return ok({ message: 'Lead updated successfully' });
  }
});
