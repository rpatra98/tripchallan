import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers/Providers";
import { headers } from 'next/headers';

const inter = Inter({ subsets: ["latin"] });

// Initialize server directories
async function initializeServer() {
  // Skip in development to avoid client/server mismatch errors
  if (process.env.NODE_ENV === 'development') return;
  
  try {
    // Call the server-init API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    await fetch(`${baseUrl}/api/server-init`, { method: 'POST' });
    console.log('Server initialization completed');
  } catch (error) {
    console.error('Failed to initialize server:', error);
  }
}

export const metadata: Metadata = {
  title: "CBUMS - Coin Based User Management System",
  description: "Role-based application with coin management",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Run server initialization
  await initializeServer();
  
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
