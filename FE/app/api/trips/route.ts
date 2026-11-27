import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { positiveInteger, readOption } from "@/lib/query-params";
import { NextRequest, NextResponse } from "next/server";
import { resolveLocationName } from "@/lib/trip-display";
import { queryPublicTrips, createTrip, queryTripsAdmin } from "@/services/tripService";
import { tripSchema } from "@/lib/validations/trip";
import { parsePublicTripFilters } from "@/lib/public-trip-search";
import { BusinessError } from "@/lib/business-error";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/trips - Lấy danh sách chuyến xe (hỗ trợ cả tìm kiếm khách đặt vé lẫn trang quản trị Admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdminMode = searchParams.get("admin") === "true";

    if (isAdminMode) {
      await requireAdmin(request);
      const result = await queryTripsAdmin({
        bookable: searchParams.get("bookable") === "true",
        search: searchParams.get("search") || "",
        from: searchParams.get("from") || "",
        to: searchParams.get("to") || "",
        date: searchParams.get("date") || "",
        page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10,
        sortBy: readOption(searchParams.get("sortBy"), ["createdAt", "time", "price", "availableSeats", "id"] as const, "createdAt"),
        sortOrder: readOption(searchParams.get("sortOrder"), ["asc", "desc"] as const, "desc"),
      });

      return NextResponse.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        stats: result.stats,
        message: "Lấy danh sách chuyến xe quản trị thành công",
      });
    }
    const rawMaxPrice=searchParams.get("maxPrice");
    const rawMinSeats=searchParams.get("minSeats");
    const maxPrice = rawMaxPrice === null ? undefined : Number(rawMaxPrice);
    const minSeats = rawMinSeats === null ? 1 : Number(rawMinSeats);
    if(
      rawMaxPrice !== null && (!/^\d+$/.test(rawMaxPrice) || !Number.isSafeInteger(maxPrice))
    ){
      throw new BusinessError("maxPirce phải là số nguyên không âm");
    }
    if (
      rawMinSeats !== null && 
      (
        !/^\d+$/.test(rawMinSeats) ||
        !Number.isSafeInteger(minSeats) ||
        minSeats < 1
      )
    ){
      throw new BusinessError("minSeats phải là số nguyên dương");
    }

    const filters = parsePublicTripFilters({
      from: searchParams.getAll("from"),
      to: searchParams.getAll("to"),
      date: searchParams.getAll("date"),
      times: searchParams.getAll("times"),
      vehicles: searchParams.getAll("vehicles"),
      page: searchParams.getAll("page"),
    });
    const result = await queryPublicTrips({
      fromCity: resolveLocationName(filters.from),
      toCity: resolveLocationName(filters.to),
      date: filters.date,
      times: filters.times,
      vehicles: filters.vehicles,
      page: filters.page,
      limit: positiveInteger(searchParams.get("limit"), 10, 100),
      maxPrice,
      minSeats,
    });

    return NextResponse.json({
      success: true,
      count: result.data.length,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// POST /api/trips - Tạo và lưu trữ một tuyến xe mới
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);

    const validationResult = tripSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map((i) => i.message)
        .join(", ");
      return NextResponse.json(
        {
          success: false,
          message: errorMessage || "Dữ liệu chuyến xe không hợp lệ",
          errors: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const newTrip = await createTrip(validationResult.data);

    return NextResponse.json(
      {
        success: true,
        message: `Tạo chuyến xe ${newTrip.id} (${newTrip.from} → ${newTrip.to}) thành công!`,
        data: newTrip,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
