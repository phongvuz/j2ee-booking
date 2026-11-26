import { BusinessError } from "@/lib/business-error";

export function isPaymentDemoEnabled() {
  return process.env.PAYMENT_DEMO_ENABLED === "true";
}

export function getVietqrConfig() {
  const bankId = process.env.VIETQR_BANK_ID?.trim() ?? "";
  const bankName = process.env.VIETQR_BANK_NAME?.trim() || bankId;
  const accountNo = process.env.VIETQR_ACCOUNT_NO?.trim() ?? "";
  const accountName = process.env.VIETQR_ACCOUNT_NAME?.trim() ?? "";
  if (!/^[a-zA-Z0-9]{2,20}$/.test(bankId) || !/^[a-zA-Z0-9]{6,19}$/.test(accountNo) || !accountName || accountName.length > 100) {
    throw new BusinessError("Chưa cấu hình đúng tài khoản nhận chuyển khoản VietQR.", 503);
  }
  return { bankId, bankName, accountNo, accountName };
}

export function createVietqrUrl(amount: number, orderCode: string) {
  const config = getVietqrConfig();
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) {
    throw new BusinessError("Số tiền thanh toán không hợp lệ.");
  }
  if (!/^[A-Z0-9]{1,25}$/.test(orderCode)) throw new BusinessError("Mã đơn hàng không hợp lệ.");
  // Quick Link là API GET trả về ảnh. Trình duyệt gọi API khi tải <img>.
  // Số tài khoản là chuỗi để giữ nguyên số 0 ở đầu.
  const name = config.accountName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toUpperCase();
  const params = new URLSearchParams({ amount: String(amount), addInfo: orderCode, accountName: name });
  return `https://img.vietqr.io/image/${config.bankId}-${config.accountNo}-compact2.png?${params}`;
}
