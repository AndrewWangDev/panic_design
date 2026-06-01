import { handlers } from "@/auth"
import { NextResponse } from "next/server"

const originalGET = handlers.GET
const originalPOST = handlers.POST

export async function GET(req: any) {
  try {
    return await originalGET(req)
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack, name: e.name }, { status: 500 })
  }
}

export async function POST(req: any) {
  try {
    return await originalPOST(req)
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack, name: e.name }, { status: 500 })
  }
}
