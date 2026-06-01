import { handlers } from "@/auth"
import { NextResponse } from "next/server"

const originalGET = handlers.GET
const originalPOST = handlers.POST

export async function GET(req: any) {
  const res = await originalGET(req)
  if (res.status === 500) {
    const { lastAuthError } = await import("@/auth")
    return NextResponse.json({ error: "Intercepted 500", details: lastAuthError }, { status: 500 })
  }
  return res
}

export async function POST(req: any) {
  try {
    return await originalPOST(req)
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack, name: e.name }, { status: 500 })
  }
}
