import Link from "next/link";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { readOption } from "@/lib/query-params";
import { paymentSortOptions } from "@/lib/admin-table-sort";
import { TableSortNavigation } from "@/components/admin/TableSortNavigation";
import type { Prisma } from "@prisma/client";
import { paymentMethodLabels } from "@/lib/booking-money";

export const metadata = { title: "Thanh toán online | Quản trị" };

const labels: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  SUCCESS: "Thành công",
  FAILED: "Thất bại / đã hủy",
  REVIEW: "Cần đối soát",
};
const PAGE_SIZE = 10;

interface PaymentsPageProps {
  searchParams: Promise<{
    page?: string;
    review?: string;
    sortBy?: string;
    sortOrder?: string;
    ledgerPage?: string;
    ledgerSearch?: string;
    kind?: string;
  }>;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function getStatusLabel(status: string, expiresAt: Date) {
  if (status === "PENDING" && expiresAt <= new Date()) {
    return "Hết hạn";
  }
  return labels[status] ?? status;
}

// Server Component: kiểm tra quyền và đọc database trên máy chủ.
export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireAdmin();

  // Trong phiên bản Next.js này, searchParams là Promise nên cần await.
  const params = await searchParams;
  const ledgerWhere: Prisma.BookingTransactionWhereInput = {};
  if (params.ledgerSearch?.trim()) ledgerWhere.booking = { pnr: { contains: params.ledgerSearch.trim().slice(0, 191) } };
  if (params.kind === "RECEIPT" || params.kind === "REFUND") ledgerWhere.kind = params.kind;
  const ledgerCount = await prisma.bookingTransaction.count({ where: ledgerWhere });
  const ledgerPages = Math.max(1, Math.ceil(ledgerCount / PAGE_SIZE));
  const requestedLedgerPage = Number(params.ledgerPage);
  const ledgerPage = Number.isSafeInteger(requestedLedgerPage) && requestedLedgerPage > 0 ? Math.min(requestedLedgerPage, ledgerPages) : 1;
  const ledger = await prisma.bookingTransaction.findMany({
    where: ledgerWhere, include: { booking: { select: { pnr: true, seatNumber: true } }, actor: { select: { fullName: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (ledgerPage - 1) * PAGE_SIZE, take: PAGE_SIZE,
  });
  function ledgerLink(page: number) {
    const query = new URLSearchParams({ ledgerPage: String(page) });
    if (params.ledgerSearch) query.set("ledgerSearch", params.ledgerSearch);
    if (params.kind) query.set("kind", params.kind);
    return `/admin/payments?${query.toString()}`;
  }
  const sortBy = readOption(
    params.sortBy ?? null,
    ["createdAt", "amount", "pnr", "id"] as const,
    "createdAt",
  );
  const sortOrder = readOption(params.sortOrder ?? null, ["asc", "desc"] as const, "desc");
  const sort = { sortBy, sortOrder };

  const where: Prisma.PaymentWhereInput = {};
  if (params.review === "1") {
    where.status = "REVIEW";
  }

  const count = await prisma.payment.count({ where });
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const requestedPage = Number(params.page);
  let page = 1;
  if (Number.isInteger(requestedPage) && requestedPage > 0) {
    page = Math.min(requestedPage, pages);
  }

  const orderBy: Prisma.PaymentOrderByWithRelationInput = { [sortBy]: sortOrder };
  let paymentOrder: Prisma.PaymentOrderByWithRelationInput | Prisma.PaymentOrderByWithRelationInput[] = orderBy;
  if (sortBy !== "id") {
    // Khi hai giao dịch bằng nhau, dùng id để thứ tự phân trang ổn định.
    paymentOrder = [orderBy, { id: "desc" }];
  }
  const payments = await prisma.payment.findMany({
    where,
    orderBy: paymentOrder,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const query = new URLSearchParams({ sortBy, sortOrder });
  if (params.review === "1") {
    query.set("review", "1");
  }

  function pageLink(number: number) {
    const next = new URLSearchParams(query);
    next.set("page", String(number));
    return `/admin/payments?${next.toString()}`;
  }

  function filterLink(review: boolean) {
    const next = new URLSearchParams({ sortBy, sortOrder });
    if (review) {
      next.set("review", "1");
    }
    return `/admin/payments?${next.toString()}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Sổ thu / hoàn tiền</h1>
      <p className="my-3 text-sm text-gray-600">Mỗi khoản tiền gắn với một vé. Các vé chung một lần thu có cùng mã giao dịch. Hủy vé không xóa khoản thu; hoàn tiền được ghi thành dòng riêng.</p>
      <form className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">PNR<input name="ledgerSearch" defaultValue={params.ledgerSearch ?? ""} className="ml-2 rounded border p-2" /></label>
        <label className="text-sm">Loại<select name="kind" defaultValue={params.kind ?? ""} className="ml-2 rounded border p-2"><option value="">Tất cả</option><option value="RECEIPT">Thu tiền</option><option value="REFUND">Hoàn tiền</option></select></label>
        <button type="submit" className="rounded border px-4 py-2 text-sm">Lọc sổ tiền</button>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100"><tr>{["PNR / Ghế", "Loại / Số tiền", "Phương thức", "Người xử lý", "Thời điểm / Mã giao dịch"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
          <tbody>{ledger.map((entry) => <tr key={entry.id} className="border-t">
            <td className="p-3"><Link className="text-blue-700 underline" href={`/admin/orders?search=${encodeURIComponent(entry.booking.pnr ?? "")}`}>{entry.booking.pnr}</Link><p>Ghế {entry.booking.seatNumber}</p></td>
            <td className="p-3">{entry.kind === "RECEIPT" ? "Thu" : "Hoàn"}<p className="font-semibold">{entry.amount.toLocaleString("vi-VN")} đ</p></td>
            <td className="p-3">{paymentMethodLabels[entry.method]}</td>
            <td className="p-3">{entry.actor?.fullName ?? (entry.method === "DEMO" ? "Khách / hệ thống demo" : "Chưa rõ từ dữ liệu cũ")}</td>
            <td className="p-3">{formatDate(entry.createdAt)}<p className="break-all text-xs text-gray-500">{entry.reference}</p></td>
          </tr>)}</tbody>
        </table>
        {!ledger.length && <p className="p-6 text-gray-500">Chưa có khoản thu / hoàn phù hợp.</p>}
      </div>
      <div className="my-4 flex gap-5 text-sm"><span>Sổ tiền: trang {ledgerPage}/{ledgerPages} · {ledgerCount} dòng phân bổ theo vé</span>{ledgerPage > 1 && <Link href={ledgerLink(ledgerPage - 1)} className="text-blue-700">Trang trước</Link>}{ledgerPage < ledgerPages && <Link href={ledgerLink(ledgerPage + 1)} className="text-blue-700">Trang sau</Link>}</div>
      <h2 className="mt-8 text-xl font-bold">Lịch sử thanh toán online</h2>
      <p className="my-3 text-sm text-gray-600">VietQR Demo: giao dịch được tạo khi khách bấm “Tôi đã chuyển khoản”. Đây là xác nhận giả lập, chưa được ngân hàng kiểm chứng. Lịch sử cổng thanh toán cũ được giữ để đối chiếu.</p>
      <div className="mb-4 flex gap-5 text-sm font-semibold text-blue-700">
        <Link href={filterLink(false)}>Tất cả</Link>
        <Link href={filterLink(true)}>Cần đối soát</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <TableSortNavigation
          pathname="/admin/payments"
          query={query.toString()}
          value={sort}
          options={paymentSortOptions}
        />
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              {["Mã đặt chỗ", "Số tiền", "Trạng thái", "Phương thức / Mã giao dịch", "Ngày tạo / xác nhận"].map((label) => (
                <th key={label} className="p-3">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t">
                <td className="p-3">
                  <Link className="text-blue-700 underline" href={`/admin/orders?search=${encodeURIComponent(payment.pnr)}`}>
                    {payment.pnr}
                  </Link>
                  <p className="mt-1 break-all text-xs text-gray-500">{payment.id}</p>
                </td>
                <td className="whitespace-nowrap p-3">{payment.amount.toLocaleString("vi-VN")} đ</td>
                <td className={`p-3 font-semibold ${payment.status === "REVIEW" ? "text-red-700" : ""}`}>
                  {getStatusLabel(payment.status, payment.expiresAt)}
                </td>
                <td className="max-w-xs break-all p-3">
                  <p className="font-semibold">{payment.responseCode === "DEMO" ? "VietQR " : "Cổng thanh toán cũ"}</p>
                  {payment.providerTransactionId ?? "—"}
                </td>
                <td className="whitespace-nowrap p-3">
                  {formatDate(payment.createdAt)}
                  <p className="text-xs text-gray-500">{payment.paidAt ? formatDate(payment.paidAt) : "Chưa nhận thanh toán"}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <p className="p-6 text-gray-500">Chưa có giao dịch.</p>}
      </div>
      <div className="mt-4 flex items-center gap-5 text-sm">
        <span>Trang {page}/{pages} · {count} giao dịch</span>
        {page > 1 && <Link href={pageLink(page - 1)} className="text-blue-700">Trang trước</Link>}
        {page < pages && <Link href={pageLink(page + 1)} className="text-blue-700">Trang sau</Link>}
      </div>
    </div>
  );
}
