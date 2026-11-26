import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-playfair",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata = {
  title: "NOMAD - Cùng bạn đi xa hơn | Khám phá & Đặt vé",
  description: "Hành trình được chọn lọc để bạn khám phá thiên nhiên, văn hóa và nhịp sống bản địa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${playfair.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased bg-brand-bg text-brand-text">
        {children}
      </body>
    </html>
  );
}
