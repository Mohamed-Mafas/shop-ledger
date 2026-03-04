import "./globals.css";

export const metadata = {
  title: "Shop Ledger",
  description: "Supplier Ledger & Purchase Management - Lakbima Traders",
  themeColor: "#1e293b",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
