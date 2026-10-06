import { NextResponse } from "next/server";
import { seedAll } from "@/lib/persist";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await seedAll();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await seedAll();
  return NextResponse.json(result);
}
