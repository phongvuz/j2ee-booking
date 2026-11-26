require("dotenv/config");
const { randomBytes, scryptSync } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 6 || password.length > 128) throw new Error("Thiết lập SEED_PASSWORD từ 6–128 ký tự trước khi tạo dữ liệu mẫu.");
  await prisma.$transaction(async (tx) => {
    const counts = await Promise.all([tx.user.count(), tx.trip.count(), tx.booking.count(), tx.customer.count(), tx.employee.count(), tx.bus.count(), tx.seatHold.count()]);
    if (counts.some((count) => count > 0)) throw new Error("Seed chỉ dùng cho database trống. Dữ liệu hiện có được giữ nguyên.");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  // 1. Tạo Users mẫu
  const usersData = [
    {
      fullName: "Nguyễn Văn An",
      phone: "0901234567",
      password: passwordHash,
      role: "USER",
    },
    {
      fullName: "Trần Thị Bình",
      phone: "0987654321",
      password: passwordHash,
      role: "ADMIN",
    },
    {
      fullName: "Lê Văn Cường",
      phone: "0912888999",
      password: passwordHash,
      role: "USER",
    },
    {
      fullName: "Phạm Thu Hương",
      phone: "0933777666",
      password: passwordHash,
      role: "USER",
    },
    {
      fullName: "Hoàng Minh Đức",
      phone: "0977112233",
      password: passwordHash,
      role: "USER",
    },
    {
      fullName: "Võ Ngọc Mai",
      phone: "0966445566",
      password: passwordHash,
      role: "USER",
    },
  ];

  const createdUsers = [];
  for (const u of usersData) {
    const user = await tx.user.create({ data: u });
    createdUsers.push(user);
  }

  // 2. Tạo danh sách Xe (Bus) mẫu
  const busesData = [
    {
      id: "BUS-001",
      plate: "51B-123.45",
      type: "Limousine 22 phòng",
      capacity: 22,
      status: "Đang hoạt động",
      brand: "Thaco Mobihome",
      year: 2023,
      driverName: "Nguyễn Văn A",
      driverPhone: "0901234567",
      lastMaintenance: "2026-08-15",
      notes: "Xe VIP chuyên tuyến Sài Gòn - Đà Lạt",
    },
    {
      id: "BUS-002",
      plate: "51B-987.65",
      type: "Giường nằm 34 chỗ",
      capacity: 34,
      status: "Đang hoạt động",
      brand: "Hyundai Tracomeco",
      year: 2022,
      driverName: "Phạm Văn D",
      driverPhone: "0934567890",
      lastMaintenance: "2026-07-20",
      notes: "Tuyến Sài Gòn - Nha Trang",
    },
    {
      id: "BUS-003",
      plate: "51B-456.78",
      type: "Giường nằm 34 chỗ",
      capacity: 34,
      status: "Bảo dưỡng",
      brand: "Thaco King Long",
      year: 2021,
      driverName: "Vũ Minh Tuấn",
      driverPhone: "0967890123",
      lastMaintenance: "2026-09-25",
      notes: "Đang thay dầu máy và bảo dưỡng hệ thống phanh",
    },
    {
      id: "BUS-004",
      plate: "51B-333.33",
      type: "Limousine 22 phòng",
      capacity: 22,
      status: "Đang hoạt động",
      brand: "Thaco Mobihome VIP",
      year: 2024,
      driverName: "Đinh Công Trình",
      driverPhone: "0932145678",
      lastMaintenance: "2026-09-01",
      notes: "Xe mới đưa vào khai thác tuyến TP.HCM - Vũng Tàu",
    },
    {
      id: "BUS-005",
      plate: "49B-111.11",
      type: "Giường nằm 34 chỗ",
      capacity: 34,
      status: "Ngừng hoạt động",
      brand: "Samco Universe",
      year: 2019,
      driverName: "",
      driverPhone: "",
      lastMaintenance: "2026-05-10",
      notes: "Chờ đại tu tổng thể động cơ",
    },
    {
      id: "BUS-006",
      plate: "51B-777.89",
      type: "Ghế ngồi 28 chỗ",
      capacity: 28,
      status: "Đang hoạt động",
      brand: "Hyundai County",
      year: 2023,
      driverName: "Nguyễn Văn A",
      driverPhone: "0901234567",
      lastMaintenance: "2026-08-30",
      notes: "Chạy tăng cường các dịp lễ và cuối tuần",
    },
    {
      id: "BUS-007",
      plate: "51B-888.66",
      type: "Limousine 22 phòng",
      capacity: 22,
      status: "Đang hoạt động",
      brand: "Thaco Mobihome",
      year: 2023,
      driverName: "Phạm Văn D",
      driverPhone: "0934567890",
      lastMaintenance: "2026-08-10",
      notes: "Tuyến Sài Gòn - Đà Nẵng",
    },
    {
      id: "BUS-008",
      plate: "51B-555.22",
      type: "Giường nằm 34 chỗ",
      capacity: 34,
      status: "Bảo dưỡng",
      brand: "Thaco TB120",
      year: 2022,
      driverName: "Vũ Minh Tuấn",
      driverPhone: "0967890123",
      lastMaintenance: "2026-09-22",
      notes: "Kiểm tra định kỳ 50,000km",
    },
  ];

  for (const bus of busesData) {
    await tx.bus.create({ data: bus });
  }

  // 3. Tạo danh sách Chuyến xe (Trip) mẫu
  const tripsData = [
    {
      from: "Hồ Chí Minh",
      to: "Đà Lạt",
      time: new Date("2026-10-04T21:00:00Z"),
      price: 300000,
      busId: "BUS-002",
    },
    {
      from: "Hồ Chí Minh",
      to: "Đà Lạt",
      time: new Date("2026-10-04T23:00:00Z"),
      price: 350000,
      busId: "BUS-001",
    },
    {
      from: "Hồ Chí Minh",
      to: "Nha Trang",
      time: new Date("2026-10-04T22:30:00Z"),
      price: 280000,
      busId: "BUS-002",
    },
    {
      from: "Hồ Chí Minh",
      to: "Vũng Tàu",
      time: new Date("2026-10-04T07:30:00Z"),
      price: 160000,
      busId: "BUS-006",
    },
    {
      from: "Hồ Chí Minh",
      to: "Hà Nội",
      time: new Date("2026-10-05T08:00:00Z"),
      price: 900000,
      busId: "BUS-002",
    },
    {
      from: "Đà Lạt",
      to: "Hồ Chí Minh",
      time: new Date("2026-10-04T21:30:00Z"),
      price: 300000,
      busId: "BUS-002",
    },
    {
      from: "Hồ Chí Minh",
      to: "Đà Nẵng",
      time: new Date("2026-10-05T14:00:00Z"),
      price: 450000,
      busId: "BUS-002",
    },
    {
      from: "Hồ Chí Minh",
      to: "Cần Thơ",
      time: new Date("2026-10-04T09:00:00Z"),
      price: 180000,
      busId: "BUS-006",
    },
  ];

  const createdTrips = [];
  for (const t of tripsData) {
    const assignedBus = busesData.find((bus) => bus.id === t.busId);
    const created = await tx.trip.create({ data: { ...t, time: new Date(Date.now() + (createdTrips.length + 1) * 24 * 60 * 60 * 1000), availableSeats: assignedBus.capacity } });
    createdTrips.push(created);
  }

  // 4. Tạo Đơn đặt vé (Booking) mẫu
  const bookingsData = [
    {
      seatNumber: "A01",
      status: "CONFIRMED",
      totalPrice: createdTrips[0].price,
      userId: createdUsers[0].id,
      tripId: createdTrips[0].id,
    },
    {
      seatNumber: "A02",
      status: "CONFIRMED",
      totalPrice: createdTrips[0].price,
      userId: createdUsers[0].id,
      tripId: createdTrips[0].id,
    },
    {
      seatNumber: "B05",
      status: "PENDING",
      totalPrice: createdTrips[1].price,
      userId: createdUsers[1].id,
      tripId: createdTrips[1].id,
    },
    {
      seatNumber: "B06",
      status: "CONFIRMED",
      totalPrice: createdTrips[1].price,
      userId: createdUsers[2].id,
      tripId: createdTrips[1].id,
    },
    {
      seatNumber: "A03",
      status: "CONFIRMED",
      totalPrice: createdTrips[2].price,
      userId: createdUsers[3].id,
      tripId: createdTrips[2].id,
    },
    {
      seatNumber: "A04",
      status: "CONFIRMED",
      totalPrice: createdTrips[2].price,
      userId: createdUsers[3].id,
      tripId: createdTrips[2].id,
    },
    {
      seatNumber: "C01",
      status: "CONFIRMED",
      totalPrice: createdTrips[3].price,
      userId: createdUsers[4].id,
      tripId: createdTrips[3].id,
    },
    {
      seatNumber: "A05",
      status: "CANCELLED",
      totalPrice: createdTrips[5].price,
      userId: createdUsers[5].id,
      tripId: createdTrips[5].id,
    },
    {
      seatNumber: "A06",
      status: "CONFIRMED",
      totalPrice: createdTrips[5].price,
      userId: createdUsers[5].id,
      tripId: createdTrips[5].id,
    },
  ];

  for (const b of bookingsData) {
    const passenger = createdUsers.find((user) => user.id === b.userId);
    const booking = await tx.booking.create({ data: { ...b, pnr: `NHAXE-SEED-${randomBytes(8).toString("hex").toUpperCase()}`,
      passengerName: passenger.fullName, passengerPhone: passenger.phone,
      activeSeat: b.status === "CANCELLED" ? null : `${b.tripId}:${b.seatNumber}`,
      confirmedAt: b.status === "CONFIRMED" ? new Date() : null } });
    if (b.status === "CONFIRMED") await tx.bookingTransaction.create({ data: {
      bookingId: booking.id, kind: "RECEIPT", amount: booking.totalPrice,
      method: "DEMO", reference: `SEED-${booking.id}`,
    } });
    if (b.status !== "CANCELLED") await tx.trip.update({ where: { id: b.tripId }, data: { availableSeats: { decrement: 1 } } });
  }

  // 5. Tạo danh sách Nhân viên (Employee)
  const employeesData = [
    {
      id: "EMP-001",
      name: "Nguyễn Văn A",
      email: "nguyenvana@nhaxe.vn",
      phone: "0901234567",
      role: "Tài xế",
      department: "Đội xe",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
      identityCard: "079201001234",
      address: "Quận 1, TP. Hồ Chí Minh",
      startDate: "2023-01-15",
    },
    {
      id: "EMP-002",
      name: "Trần Thị B",
      email: "tranthib@nhaxe.vn",
      phone: "0912345678",
      role: "Văn phòng",
      department: "Phòng vé",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      identityCard: "079202002345",
      address: "Quận 5, TP. Hồ Chí Minh",
      startDate: "2023-03-20",
    },
    {
      id: "EMP-003",
      name: "Lê Hoàng C",
      email: "lehoangc@nhaxe.vn",
      phone: "0923456789",
      role: "Phụ xe",
      department: "Đội xe",
      status: "Nghỉ phép",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
      identityCard: "079203003456",
      address: "TP. Thủ Đức, TP. Hồ Chí Minh",
      startDate: "2023-06-10",
    },
    {
      id: "EMP-004",
      name: "Phạm Văn D",
      email: "phamvand@nhaxe.vn",
      phone: "0934567890",
      role: "Tài xế",
      department: "Đội xe",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      identityCard: "079204004567",
      address: "Quận Bình Thạnh, TP. Hồ Chí Minh",
      startDate: "2023-09-01",
    },
    {
      id: "EMP-005",
      name: "Hoàng Thị E",
      email: "hoangthie@nhaxe.vn",
      phone: "0945678901",
      role: "Quản lý",
      department: "Ban điều hành",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
      identityCard: "079205005678",
      address: "Quận 3, TP. Hồ Chí Minh",
      startDate: "2022-11-15",
    },
    {
      id: "EMP-006",
      name: "Vũ Minh Tuấn",
      email: "tuanvm@nhaxe.vn",
      phone: "0967890123",
      role: "Tài xế",
      department: "Đội xe",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
      identityCard: "079206006789",
      address: "Quận 10, TP. Hồ Chí Minh",
      startDate: "2024-01-08",
    },
    {
      id: "EMP-007",
      name: "Đặng Thu Thảo",
      email: "thaodt@nhaxe.vn",
      phone: "0978901234",
      role: "Văn phòng",
      department: "Kế toán",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      identityCard: "079207007890",
      address: "Quận Phú Nhuận, TP. Hồ Chí Minh",
      startDate: "2024-02-14",
    },
    {
      id: "EMP-008",
      name: "Bùi Quốc Hưng",
      email: "hungbq@nhaxe.vn",
      phone: "0989012345",
      role: "Điều hành",
      department: "Ban điều hành",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
      identityCard: "079208008901",
      address: "Quận Gò Vấp, TP. Hồ Chí Minh",
      startDate: "2024-03-01",
    },
    {
      id: "EMP-009",
      name: "Ngô Thanh Hằng",
      email: "hangnt@nhaxe.vn",
      phone: "0918765432",
      role: "Văn phòng",
      department: "Phòng vé",
      status: "Đã nghỉ việc",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
      identityCard: "079209009012",
      address: "Quận Tân Bình, TP. Hồ Chí Minh",
      startDate: "2023-04-12",
    },
    {
      id: "EMP-010",
      name: "Đinh Công Trình",
      email: "trinhdc@nhaxe.vn",
      phone: "0932145678",
      role: "Tài xế",
      department: "Đội xe",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
      identityCard: "079210001023",
      address: "Quận 12, TP. Hồ Chí Minh",
      startDate: "2024-05-20",
    },
    {
      id: "EMP-011",
      name: "Lý Hải Đăng",
      email: "danglh@nhaxe.vn",
      phone: "0943215678",
      role: "Phụ xe",
      department: "Đội xe",
      status: "Đang làm việc",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
      identityCard: "079211002134",
      address: "Huyện Hóc Môn, TP. Hồ Chí Minh",
      startDate: "2024-06-01",
    },
    {
      id: "EMP-012",
      name: "Phan Kim Oanh",
      email: "oanhpk@nhaxe.vn",
      phone: "0954321678",
      role: "Văn phòng",
      department: "Kế toán",
      status: "Nghỉ phép",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
      identityCard: "079212003245",
      address: "Quận 7, TP. Hồ Chí Minh",
      startDate: "2024-06-15",
    },
  ];

  for (const emp of employeesData) {
    await tx.employee.create({ data: emp });
  }

  const driver = employeesData.find((employee) => employee.role === "Tài xế" && employee.status === "Đang làm việc");
  for (const trip of createdTrips) {
    const bus = busesData.find((bus) => bus.id === trip.busId && bus.status === "Đang hoạt động");
    if (!bus || !driver) continue;
    const booked = await tx.booking.count({ where: { tripId: trip.id, status: { not: "CANCELLED" } } });
    await tx.trip.update({ where: { id: trip.id }, data: {
      driverId: driver.id, availableSeats: bus.capacity - booked,
      endsAt: new Date(trip.time.getTime() + 12 * 3600000), status: "OPEN",
    } });
  }

  console.log("✅ Đã tạo thành công dữ liệu mẫu hoàn chỉnh cho tất cả các bảng!");
  console.log(`- Người dùng: ${createdUsers.length}`);
  console.log(`- Tuyến xe: ${createdTrips.length}`);
  console.log(`- Đơn vé: ${bookingsData.length}`);
  console.log(`- Xe: ${busesData.length}`);
  console.log(`- Nhân sự: ${employeesData.length}`);
  }, { timeout: 30000 });
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi tạo dữ liệu mẫu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
