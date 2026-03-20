import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "Code Sprint 2026";
const providerName = process.env.NEXT_PUBLIC_PROVIDER_NAME || "Secure Online Assessment Platform";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata = {
  title: appTitle,
  description: providerName,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-poppins antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
