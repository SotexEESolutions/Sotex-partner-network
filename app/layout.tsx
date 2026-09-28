import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Texas Accounting Partners",
  description: "Prospecting intelligence for South Texas accounting and payroll partnerships.",
  openGraph: { title: "Texas Accounting Partners", description: "Texas partnership intelligence, organized.", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "Texas Accounting Partners", description: "Texas partnership intelligence, organized.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
