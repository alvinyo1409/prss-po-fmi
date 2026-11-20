"use client";

const LOGO_URL =
  "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800";

export default function HomePage() {
  return (
    <>
      {/* HEADER LOGO & JUDUL */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="Logo Panen Raya" className="company-logo" />
      <h1>
        CV. Panen Raya Sukses Sejahtera
      </h1>
      <p className="sub-title">
        Formulir Pemesanan Produk — Mitra Toko FamilyMart
      </p>

      {/* WADAH UTAMA FORM */}
      <div className="menu-box">
        <h2>
          <i className="fa-solid fa-store" style={{ marginRight: 8 }}></i>
          Formulir Pemesanan Toko
        </h2>

        <div style={{ textAlign: "center", padding: "30px 10px", color: "#475569" }}>
          <i
            className="fa-solid fa-clipboard-check"
            style={{ fontSize: 44, color: "#117b3d", marginBottom: 15 }}
          ></i>
          <p style={{ margin: "0 0 10px 0", fontWeight: "bold", fontSize: 16, color: "#0e6231" }}>
            Desain Tema Berhasil Diselaraskan
          </p>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: "#64748b" }}>
            Tampilan visual (background pemandangan terasering sawah, logo, tipografi, warna hijau utama, dan kartu) kini sudah seragam dengan Portal PRSS-Operasional.
          </span>
        </div>
      </div>

      {/* FOOTER */}
      <div className="app-footer">
        <span>CV. Panen Raya Sukses Sejahtera &copy; 2026</span>
        <span>Portal Pemesanan FMI v1.0</span>
      </div>
    </>
  );
}
