import type { Metadata } from "next";
import { Anton } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tropa da Inglaterra",
  description: "Dashboard Oficial da Facção",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={anton.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}