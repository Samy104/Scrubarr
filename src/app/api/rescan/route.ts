import { NextResponse } from 'next/server';
import { refreshDupes } from '@/lib/scanner';

export async function POST() {
  refreshDupes().catch(() => {}); // fire and forget
  return NextResponse.json({ queued: true });
}
