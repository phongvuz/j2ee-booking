export interface PaymentState {
  status: string;
  bookingStatus: string;
  received?: number;
  refunded?: number;
  refundDue?: number;
  amountDue?: number;
}

export interface VietqrPaymentInfo {
  bankName: string;
  accountNo: string;
  accountName: string;
  order_code: string;
  total_amount: number;
  qrUrl: string;
}
