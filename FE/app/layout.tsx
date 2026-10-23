import "./globals.css";

export const metadata = {
  title: "Nhà xe Sài Gòn",
  description: "Dịch vụ đặt vé xe trực tuyến chất lượng cao",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        {children}
      </body>
    </html>
  );
}
