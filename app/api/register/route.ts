import { NextResponse } from "next/server"
import { adminDb } from "@/lib/supabase/server"
import { registerUser } from "@/lib/registration"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const result = await registerUser(body, (input) => adminDb().auth.admin.createUser(input))
  return NextResponse.json(result.error ? { error: result.error } : { ok: true }, { status: result.status })
}
