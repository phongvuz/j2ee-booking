# j2ee-booking

Dự án đặt vé xe, tách riêng frontend và backend.

```text
j2ee-booking/
├── FE/                  # Frontend Next.js 16, React 19, TypeScript
│   ├── app/             # Trang client, admin và dữ liệu mẫu
│   ├── public/          # Tài nguyên tĩnh
│   ├── package.json
│   └── package-lock.json
├── BE/                  # Backend độc lập
│   └── TripService/     # Spring Boot quản lý xe và chuyến đi
│       ├── src/main/    # Mã nguồn và cấu hình PostgreSQL
│       ├── src/test/    # Kiểm thử tích hợp API
│       └── README.md    # Hướng dẫn chạy và tài liệu API
└── package.json         # Lệnh tiện ích chạy FE từ thư mục gốc
```

## Frontend

Cài Node.js và npm tương thích với Next.js 16. Chạy từ thư mục gốc:

```sh
npm run install:fe
npm run dev
```

Mở http://localhost:3000. Các lệnh khác: `npm run lint`, `npm run build`,
`npm run start` (sau khi build).

Có thể vào `FE/` rồi chạy trực tiếp `npm ci`, `npm run dev`, `npm run lint`,
`npm run build` hoặc `npm run start`. Dependencies và lockfile nằm trong `FE/`.
Đặt biến môi trường frontend tại `FE/.env.local` khi cần.

## Backend

Xem [BE/TripService/README.md](BE/TripService/README.md). Backend Spring Boot
quản lý xe và chuyến đi trong cùng một service, cung cấp API CRUD và tìm kiếm,
sử dụng PostgreSQL. Hướng dẫn cấu hình, API và kiểm thử nằm trong tài liệu backend.
`FE/app/lib/db.ts` là dữ liệu mẫu của giao diện; thay bằng lời gọi API khi có backend.
