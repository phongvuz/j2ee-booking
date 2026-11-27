import { NextResponse } from "next/server";
import { apiError, requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { mergeTripLocations } from "@/lib/trip-locations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const routes = await prisma.trip.findMany({
      select: { from: true, to: true },
      distinct: ["from", "to"],
    });
    const data = mergeTripLocations(routes.flatMap((route) => [route.from, route.to]));
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Không thể tải danh sách điểm đi và điểm đến.");
  }
}
