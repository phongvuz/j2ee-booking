import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/admin-api";
import { parseTripId } from "@/lib/trip-id";
import { getTripAvailability } from "@/services/tripService";

export const dynamic = "force-dynamic";

type ParamsContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: ParamsContext
) {
  try {
    const { id } = await params;

    const tripId = parseTripId(id);
    const trip = await getTripAvailability(tripId);

    if (!trip) {
      return NextResponse.json(
        {
          success: false,
          message: `Không tìm thấy chuyến xe có mã ${id}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    return apiError(
      error,
      "Không thể tra cứu số ghế trống lúc này."
    );
  }
}