import './globals.css';

export const metadata = {
  title: 'Lukana App',
  description: 'Operação diária Lukana Marcenaria',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#2D3040',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lukana App" />
        <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512" />
        <link rel="shortcut icon" href="/icon-512.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
