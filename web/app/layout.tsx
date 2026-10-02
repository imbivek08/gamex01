import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cricket Auction — Build Your Dream Squad',
  description:
    'A multiplayer live cricket auction game. Create a room, invite friends, and bid to build your dream squad.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0f1e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-pitch-950 text-slate-100 antialiased">{children}</body>
    </html>
  )
}
