import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cari Vendor Bisnis — Kontak Vendor Lokal",
  description:
    "Cari vendor (WO/wedding organizer, catering, MUA, venue, toko bunga, dll) lengkap dengan nama, no HP, WhatsApp, dan alamat di sekitar lokasi Anda.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
