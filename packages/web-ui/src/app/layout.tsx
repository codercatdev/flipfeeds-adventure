import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlipFeeds',
  description: 'A 2D multiplayer web game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
