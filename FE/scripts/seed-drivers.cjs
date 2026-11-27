const path = require("node:path");

const employeePrefix = "EMP-DISPATCH-TEST-";
const busPrefix = "BUS-DISPATCH-TEST-";

function assertLocalDatabase(environment) {
  let url;
  try {
    url = new URL(environment.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL không hợp lệ. Không in thông tin kết nối.");
  }
  if (environment.NODE_ENV === "production" || url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Chỉ tạo dữ liệu kiểm thử trên MySQL local, ngoài môi trường production.");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || ["mysql", "information_schema", "performance_schema", "sys"].includes(database.toLowerCase())) {
    throw new Error("Cần chọn database phát triển, không dùng database hệ thống.");
  }
  return database;
}

function buildDriverTestData(now = new Date()) {
  const hour = 3600000;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
  const today = formatter.format(now);
  const tomorrow = formatter.format(new Date(now.getTime() + 24 * hour));
  const atTomorrow = (time) => new Date(`${tomorrow}T${time}:00+07:00`);
  const relativeTime = (hours) => new Date(now.getTime() + hours * hour);
  const employeeId = (number) => `${employeePrefix}${String(number).padStart(2, "0")}`;
  const busId = (number) => `${busPrefix}${String(number).padStart(2, "0")}`;

  const employees = [
    ["Nguyễn Văn An", "Đang làm việc", "Tài xế"],
    ["Trần Văn Bình", "Đang làm việc", "Tài xế"],
    ["Lê Văn Cường", "Nghỉ phép", "Tài xế"],
    ["Phạm Văn Dũng", "Đã nghỉ việc", "Tài xế"],
    ["Hoàng Văn Nam", "Đang làm việc", "Tài xế"],
    ["Nguyễn Văn An", "Đang làm việc", "Tài xế"],
    ["Vũ Văn Long", "Đang làm việc", "Tài xế"],
    ["Đặng Văn Minh", "Đang làm việc", "Tài xế"],
    ["Đỗ Văn Phúc", "Đang làm việc", "Phụ xe"],
  ].map(([name, status, role], index) => ({
    id: employeeId(index + 1), name: `[TEST] ${name}`, status, role,
    email: `dispatch-test-${index + 1}@example.test`, phone: `09990071${String(index + 1).padStart(2, "0")}`,
    department: "Vận hành", startDate: today, address: "Dữ liệu giả để kiểm thử; không liên hệ",
  }));

  const buses = Array.from({ length: 5 }, (_, index) => ({
    id: busId(index + 1), plate: `51B-997.${String(index + 1).padStart(2, "0")}`,
    type: "Giường nằm 30 chỗ", capacity: 30, status: "Đang hoạt động",
    brand: "[TEST] Xe kiểm thử", notes: "Dữ liệu giả để kiểm thử phân công; không vận hành thực tế.",
  }));

  const trips = [
    ["Trùng lịch ngày mai 08:00–12:00", "OPEN", 1, 2, atTomorrow("08:00"), atTomorrow("12:00")],
    ["Giáp giờ: kết thúc ngày mai 08:00", "OPEN", 1, 7, atTomorrow("04:00"), atTomorrow("08:00")],
    ["Chuyến đang chạy, quá giờ kết thúc dự kiến", "DEPARTED", 3, 5, relativeTime(-3), relativeTime(-1)],
    ["Chuyến trễ: đổi tài xế 01 sang 06", "OPEN", 2, 1, relativeTime(-1), relativeTime(2)],
    ["Chặn xuất bến: tài xế 05 chưa xong chuyến trước", "OPEN", 4, 5, relativeTime(-0.5), relativeTime(2)],
    ["Chặn xuất bến: xe 03 chưa xong chuyến trước", "OPEN", 3, 7, relativeTime(-0.5), relativeTime(2)],
    ["Chuyến đã hoàn thành của tài xế 08", "COMPLETED", 5, 8, relativeTime(-4), relativeTime(-2)],
    ["Cho xuất bến: tài xế 08 đã xong chuyến trước", "OPEN", 5, 8, relativeTime(-0.5), relativeTime(2)],
    ["Chuyến dự kiến: chọn tài xế ngày mai 08:00–12:00", "DRAFT", 4, null, atTomorrow("08:00"), atTomorrow("12:00")],
  ].map(([label, status, bus, driver, time, endsAt]) => ({
    label,
    data: { from: "Hồ Chí Minh", to: "Cần Thơ", status, busId: busId(bus), driverId: driver ? employeeId(driver) : null, time, endsAt, price: 180000, availableSeats: 30 },
  }));
  return { employees, buses, trips };
}

async function seedDriverData(prisma, now = new Date()) {
  const data = buildDriverTestData(now);
  return prisma.$transaction(async (tx) => {
    const employees = await tx.employee.count({ where: { id: { startsWith: employeePrefix } } });
    const buses = await tx.bus.count({ where: { id: { startsWith: busPrefix } } });
    if (employees || buses) throw new Error("Đã có dữ liệu DISPATCH-TEST. Không tạo trùng hoặc ghi đè dữ liệu đã kiểm thử.");

    for (const employee of data.employees) await tx.employee.create({ data: employee });
    for (const bus of data.buses) await tx.bus.create({ data: bus });
    const trips = [];
    for (const entry of data.trips) {
      const trip = await tx.trip.create({ data: entry.data });
      trips.push({ label: entry.label, ...trip });
    }
    return { employees: data.employees, buses: data.buses, trips };
  }, { isolationLevel: "Serializable", timeout: 15000 });
}

async function main() {
  require("@next/env").loadEnvConfig(path.resolve(__dirname, ".."));
  const database = assertLocalDatabase(process.env);
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const result = await seedDriverData(prisma);
    const formatter = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short", hourCycle: "h23" });
    console.log(`Database local: ${database}. Đã thêm ${result.employees.length} nhân viên, ${result.buses.length} xe, ${result.trips.length} chuyến kiểm thử.`);
    console.log("Không tạo vé, khoản thu, khoản hoàn; không sửa hoặc xóa dữ liệu cũ.");
    console.table(result.trips.map((trip) => ({ id: trip.id, scenario: trip.label, status: trip.status, driver: trip.driverId, bus: trip.busId, start: formatter.format(trip.time), end: formatter.format(trip.endsAt) })));
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { assertLocalDatabase, buildDriverTestData, seedDriverData };

if (require.main === module) main().catch((error) => {
  console.error(error.code ? `Không tạo được dữ liệu kiểm thử (${error.code}). Kiểm tra MySQL, schema và mã/biển số/email/số điện thoại bị trùng.` : error.message);
  process.exitCode = 1;
});
