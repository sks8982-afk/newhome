import { NextResponse, type NextRequest } from 'next/server';
import { loadFilter, saveFilter } from '@/lib/db/store';
import type { UserFilter } from '@/types/announcement';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const filter = await loadFilter();
  return NextResponse.json(filter);
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as Partial<UserFilter>;
  const current = await loadFilter();
  const next: UserFilter = {
    housingTypes: body.housingTypes ?? current.housingTypes,
    regions: body.regions ?? current.regions,
    priorityCities: body.priorityCities ?? current.priorityCities,
  };
  await saveFilter(next);
  return NextResponse.json(next);
}
