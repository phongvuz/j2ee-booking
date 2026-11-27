import { requireAdmin, apiError } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/lib/business-error";
import { parseVietnamDateTime } from "@/lib/trip-search";
import { parseTripId } from "@/lib/trip-id";
import { z } from "zod";

const dateTimeSchema = z.union([z.iso.datetime({ offset: true }), z.iso.datetime({ local: true, precision: -1 })]);

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const searchParams = new URL(request.url).searchParams;
    const timeValue = searchParams.get("time");
    const endsAtValue = searchParams.get("endsAt");
    const excludeTripValue = searchParams.get("excludeTripId");
    if ((timeValue !== null || endsAtValue !== null) && (!dateTimeSchema.safeParse(timeValue).success || !dateTimeSchema.safeParse(endsAtValue).success)) {
      throw new BusinessError("Cần cung cấp giờ xuất bến và giờ kết thúc hợp lệ.");
    }
    const time = timeValue ? parseVietnamDateTime(timeValue) : null;
    const endsAt = endsAtValue ? parseVietnamDateTime(endsAtValue) : null;
    if ((time && !Number.isFinite(time.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime())) || (time && endsAt && endsAt <= time)) {
      throw new BusinessError("Khoảng thời gian chuyến không hợp lệ.");
    }
    const excludeTripId = excludeTripValue !== null ? parseTripId(excludeTripValue) : undefined;
    const [buses, drivers] = await Promise.all([
      prisma.bus.findMany({ select: { id: true, plate: true, capacity: true, status: true }, orderBy: { plate: "asc" } }),
      prisma.employee.findMany({ where: { role: "Tài xế" }, select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    ]);
    const conflicts = time && endsAt && drivers.length ? await prisma.trip.findMany({
      where: {
        ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
        driverId: { in: drivers.map((driver) => driver.id) },
        AND: [{ OR: [
          { status: { in: ["OPEN", "DEPARTED"] }, time: { lt: endsAt }, endsAt: { gt: time } },
          ...(time <= new Date() ? [{ status: "DEPARTED" }] : []),
        ] }],
      },
      select: { id: true, driverId: true, status: true },
    }) : [];
    const data = drivers.map((driver) => {
      const conflict = conflicts.find((trip) => trip.driverId === driver.id);
      const reason = driver.status !== "Đang làm việc" ? driver.status
        : conflict ? `Bận chuyến #${conflict.id}`
          : time ? "Rảnh theo lịch" : "Chọn giờ chuyến để kiểm tra lịch";
      return { ...driver, available: driver.status === "Đang làm việc" && !conflict && Boolean(time), reason, conflictTripId: conflict?.id ?? null };
    });
    return Response.json({ success: true, data: { buses, drivers: data } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Không thể tải danh sách xe và tài xế.");
  }
}
