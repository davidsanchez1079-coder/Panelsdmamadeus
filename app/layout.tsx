import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

import './globals.css';

export const metadata: Metadata = {
  title: 'Panel SDM AMADEUS',
  description: 'Panel financiero SADAMA / AMADEUS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
