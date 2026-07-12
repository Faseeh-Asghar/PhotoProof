import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'PhotoProof — Professional School Photo Processing',
  description: 'Bulk process student photos with automatic white background, 600×800 resolution, and size optimization. Built for schools and photographers.',
  keywords: 'school photos, photo processing, white background, student photos, bulk upload',
  openGraph: {
    title: 'PhotoProof — School Photo Processing',
    description: 'Process hundreds of student photos instantly. White background, perfect size.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1A2338',
              color: '#F1F5F9',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#1A2338' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#1A2338' } },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}
