import './globals.css';

export const metadata = {
  title: 'App LKN',
  description: 'Operação diária Lukana Marcenaria',
  manifest: '/manifest.json',
  icons: { icon: '/aresta-icon.svg', apple: '/aresta-icon.svg' },
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
        <meta name="apple-mobile-web-app-title" content="App LKN" />
        <link rel="icon" href="/aresta-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/aresta-icon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
