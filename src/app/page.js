"use client";

const LOGO_URL =
  "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800";

export default function HomePage() {
  return (
    <main className="container-box">
      <div className="header-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="Logo CV. Panen Raya Sukses Sejahtera" />
        <h1>CV. PANEN RAYA SUKSES SEJAHTERA</h1>
        <p>Formulir Pemesanan Produk — Mitra Toko FamilyMart</p>
      </div>
      <div style={{ textAlign: "center", padding: "20px 0", color: "#334155", fontSize: "14px" }}>
        Portal formulir pemesanan siap digunakan.
      </div>
    </main>
  );
}
