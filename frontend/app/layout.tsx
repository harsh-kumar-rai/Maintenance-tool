import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { RouteWarmer } from '@/components/route-warmer'
import './globals.css'

export const metadata: Metadata = {
  title: 'Maintenance Tool — Steel Plant Intelligence',
  description:
    'AI-powered maintenance decision support for steel plant operations',
  generator: 'v0.app',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="bg-background"
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
        <RouteWarmer />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
