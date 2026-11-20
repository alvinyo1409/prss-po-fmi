import "./globals.css";

export const metadata = {
  title: "Formulir Pemesanan FMI — CV. Panen Raya Sukses Sejahtera",
  description: "Formulir Pemesanan Toko FamilyMart — CV. Panen Raya Sukses Sejahtera",
  icons: {
    icon: "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800",
    shortcut: "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800",
    apple: "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
