"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

const LOGO_URL =
  "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800";

// Data contoh sementara untuk preview tampilan (nantinya akan ditarik langsung dari Supabase)
const SAMPLE_STORES = [
  {
    code: "0463",
    store: "KEMAKMURAN RAYA",
    dc: "Cibitung",
    type: "CVS",
    address: "Jl. Kemakmuran Raya No.43 Mekar Jaya Kec. Sukmajaya, Kota Depok Jawa Barat",
    pic: "Kiki Rosati",
  },
  {
    code: "0132",
    store: "AKR TOWER (KEBON JERUK)",
    dc: "Cibitung",
    type: "Office",
    address: "AKR Tower Galery West Level Ground Floor unit 06 Jl. Panjang No. 5 Kebon Jeruk Jakarta Barat 11530",
    pic: "Samuel Marolopan",
  },
  {
    code: "0169",
    store: "GROGOL",
    dc: "Cibitung",
    type: "CVS",
    address: "Jl. Dr. Susilo Raya No. 26A, Grogol Petamburan Jakarta Barat 11450",
    pic: "Denis Satrianes",
  },
  {
    code: "0203",
    store: "PURI INDAH FINANCIAL TOWER",
    dc: "Cibitung",
    type: "Office",
    address: "Puri Indah Financial Tower (PIFT), Jl. Puri Lingkar Dalam Blok T8, Lantai Dasar Unit No. 09, Kembangan Selatan Jakarta Barat 11610",
    pic: "Shela Tri Astuti",
  },
  {
    code: "0444",
    store: "CITY RESORT BOULEVARD",
    dc: "Cibitung",
    type: "CVS",
    address: "The City Resort Residence Rukan Miami D3-5 Jl. Boulevard Raya, Cengkareng, Jakarta Barat",
    pic: "Adika Selilo Anugrah Putra",
  },
  {
    code: "0134",
    store: "WISMA GKBI (SUDIRMAN)",
    dc: "Cibitung",
    type: "Office",
    address: "Jl. Jend. Sudirman No.28, RT.14/RW.1 Bendungan Hilir, Tanah Abang Jakarta Pusat 10210",
    pic: "Gathan Prabaskara",
  },
  {
    code: "0001",
    store: "CIBUBUR",
    dc: "Pondok Ungu",
    type: "FamiSuper",
    address: "Jl. Alternatif Cibubur, Perumahan Raffles Hills, Cimanggis Depok",
    pic: "Windy Septiya Putri",
  },
];

// Data contoh item Active FamilyMart sementara untuk preview tampilan
const SAMPLE_ITEMS = [
  { kode: "607961", barcode: "21062162", nama: "FamilyMart Basreng ExPds Daun Jrk 120-CS" },
  { kode: "607960", barcode: "21062155", nama: "FamilyMart Kerupuk MieExtra Pedas100g-CS" },
  { kode: "607969", barcode: "21062186", nama: "FamilyMart Makaroni Goreng ExPds 150g-CS" },
  { kode: "607970", barcode: "21062148", nama: "FamilyMart Makaroni Remis ExtPds 100g-CS" },
  { kode: "607962", barcode: "21062179", nama: "FamilyMart Makaroni Spiral ExPds 150g-CS" },
  { kode: "607967", barcode: "21062100", nama: "Familymart Pilus Ikan Original 95g-CS" },
  { kode: "607958", barcode: "21062094", nama: "FamilyMart Seblak Kcng Extra Pds 80g-CS" },
  { kode: "607959", barcode: "21062131", nama: "FamilyMart Seblak Mix Extra Pedas100g-CS" },
  { kode: "607966", barcode: "21062087", nama: "FamilyMart Telur Gabus Keju 70g-CS" },
  { kode: "21063671", barcode: "21063671", nama: "FamilyMart Basreng Koin Pds Jrk 120g-CS" },
  { kode: "21064111", barcode: "21064111", nama: "FamilyMart Basreng Ori Daun Jrk 120g-CS" },
  { kode: "21064128", barcode: "21064128", nama: "FamilyMart Seblak Extra Pedas 80g-CS" },
  { kode: "21064142", barcode: "21064142", nama: "FamilyMart Seblak Pedas Keju 80g-CS" },
  { kode: "21064104", barcode: "21064104", nama: "FamilyMart Krupuk Extra Pedas 100g-CS" },
  { kode: "21064135", barcode: "21064135", nama: "FamilyMart Makaroni Pedas Keju 150g-CS" },
];

const INITIAL_ROWS = [
  { id: "row-1", kode: "", nama: "", qty: "" },
  { id: "row-2", kode: "", nama: "", qty: "" },
];

export default function HomePage() {
  const [tanggalLabel, setTanggalLabel] = useState("");

  // State Toko (2 arah: Kode <-> Nama)
  const [kodeToko, setKodeToko] = useState("");
  const [namaToko, setNamaToko] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);

  // State Daftar Item Pesanan
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [catatan, setCatatan] = useState("");

  // Ref counter ID baris & auto-fokus input baris baru saat tekan Enter
  const nextRowIdRef = useRef(3);
  const namaInputRefs = useRef({});

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    queueMicrotask(() => {
      setTanggalLabel(formatter.format(new Date()));
    });
  }, []);

  // --- Handler Pilih Toko (2 Arah) ---
  const handleKodeTokoChange = (val) => {
    setKodeToko(val);
    const clean = val.trim().toLowerCase();
    const match = SAMPLE_STORES.find((s) => s.code.toLowerCase() === clean);
    if (match) {
      setNamaToko(match.store);
      setSelectedStore(match);
    } else {
      setSelectedStore(null);
    }
  };

  const handleNamaTokoChange = (val) => {
    setNamaToko(val);
    const clean = val.trim().toLowerCase();
    const match = SAMPLE_STORES.find((s) => s.store.toLowerCase() === clean);
    if (match) {
      setKodeToko(match.code);
      setSelectedStore(match);
    } else {
      setSelectedStore(null);
    }
  };

  const resetToko = () => {
    setKodeToko("");
    setNamaToko("");
    setSelectedStore(null);
  };

  // --- Handler Baris Item (2 Arah) ---
  const handleKodeItemChange = (idx, val) => {
    const clean = val.trim().toLowerCase();
    const match = SAMPLE_ITEMS.find(
      (it) => it.kode.toLowerCase() === clean || it.barcode.toLowerCase() === clean
    );
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          kode: val,
          nama: match ? match.nama : row.nama,
        };
      })
    );
  };

  const handleNamaItemChange = (idx, val) => {
    const clean = val.trim().toLowerCase();
    const match = SAMPLE_ITEMS.find((it) => it.nama.toLowerCase() === clean);
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          nama: val,
          kode: match ? match.kode : row.kode,
        };
      })
    );
  };

  const handleQtyChange = (idx, val) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: val } : row)));
  };

  const buatBarisBaru = () => {
    const id = `row-${nextRowIdRef.current}`;
    nextRowIdRef.current += 1;
    return { id, kode: "", nama: "", qty: "" };
  };

  const tambahBaris = (autoFocus = false) => {
    const newRow = buatBarisBaru();
    setRows((prev) => [...prev, newRow]);
    if (autoFocus) {
      setTimeout(() => {
        const el = namaInputRefs.current[newRow.id];
        if (el) el.focus();
      }, 30);
    }
  };

  const hapusBaris = (idx) => {
    if (rows.length <= 1) {
      setRows([buatBarisBaru()]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQtyKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx === rows.length - 1) {
        tambahBaris(true);
      } else {
        const nextRow = rows[idx + 1];
        const el = nextRow ? namaInputRefs.current[nextRow.id] : null;
        if (el) el.focus();
      }
    }
  };

  // Hitung ringkasan aktif
  const validItems = rows.filter(
    (r) => (r.kode.trim() !== "" || r.nama.trim() !== "") && Number(r.qty) > 0
  );
  const totalQty = validItems.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);

  // --- Handler Tombol Buat Pesanan (Preview Mode) ---
  const handleBuatPesanan = (e) => {
    e.preventDefault();

    if (!selectedStore && (!kodeToko.trim() || !namaToko.trim())) {
      Swal.fire({
        icon: "warning",
        title: "Toko Belum Dipilih",
        text: "Silakan pilih Kode Toko atau Nama Toko Anda terlebih dahulu.",
        confirmButtonColor: "#117b3d",
      });
      return;
    }

    if (validItems.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Daftar Item Kosong",
        text: "Harap pilih minimal 1 item dan isi jumlah Qty lebih dari 0.",
        confirmButtonColor: "#117b3d",
      });
      return;
    }

    const daftarHtml = validItems
      .map(
        (it, i) =>
          `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;text-align:left;">
            <span><strong>${i + 1}.</strong> ${it.nama || it.kode}</span>
            <span style="white-space:nowrap;font-weight:bold;color:#0e6231;">${Number(it.qty).toLocaleString("id-ID")} Pcs</span>
          </div>`
      )
      .join("");

    Swal.fire({
      icon: "success",
      title: "Preview Pesanan Siap!",
      html: `
        <div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;">
          <div><strong>Toko:</strong> ${kodeToko} — ${namaToko}</div>
          ${selectedStore ? `<div><strong>DC / PIC:</strong> ${selectedStore.dc} / ${selectedStore.pic}</div>` : ""}
          ${catatan.trim() ? `<div><strong>Catatan:</strong> ${catatan.trim()}</div>` : ""}
        </div>
        <div style="max-height:200px;overflow-y:auto;margin-bottom:12px;">${daftarHtml}</div>
        <div style="font-size:14px;font-weight:bold;color:#0e6231;text-align:right;">
          Total: ${validItems.length} Jenis Item (${totalQty.toLocaleString("id-ID")} Pcs)
        </div>
        <p style="font-size:11px;color:#64748b;margin-top:12px;margin-bottom:0;">
          *Mode Preview Tampilan — belum terhubung ke database Supabase.
        </p>
      `,
      confirmButtonText: "Oke, Mengerti",
      confirmButtonColor: "#117b3d",
    });
  };

  return (
    <>
      {/* HEADER LOGO & BRAND */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="Logo Panen Raya" className="company-logo" />
      <h1>CV. Panen Raya Sukses Sejahtera</h1>
      <p className="sub-title">Portal Pemesanan Produk — Mitra Toko FamilyMart</p>

      {/* KARTU FORMULIR UTAMA */}
      <form className="order-card" onSubmit={handleBuatPesanan}>
        <div className="card-welcome">
          <div>
            <h2>
              <i className="fa-solid fa-cart-shopping"></i>
              Formulir Pemesanan Toko
            </h2>
            <p className="card-welcome-sub">
              Selamat datang! Silakan pilih identitas toko dan daftar item yang ingin dipesan.
            </p>
          </div>
          {tanggalLabel && (
            <span className="date-badge">
              <i className="fa-regular fa-calendar"></i>
              {tanggalLabel}
            </span>
          )}
        </div>

        {/* BAGIAN 1: PILIH TOKO */}
        <div className="section-block">
          <div className="section-header">
            <span className="step-badge">1</span>
            <h3>Silakan Pilih Toko Anda</h3>
          </div>
          <p className="section-hint">
            Pilih salah satu (Kode Toko atau Nama Toko), kolom lainnya akan otomatis terisi.
          </p>

          <div className="store-grid">
            <div className="field-group">
              <label htmlFor="inputKodeToko">Kode Toko</label>
              <input
                id="inputKodeToko"
                type="text"
                list="listKodeToko"
                className="input-field input-field-code"
                placeholder="Contoh: 0463"
                value={kodeToko}
                onChange={(e) => handleKodeTokoChange(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <label htmlFor="inputNamaToko">Nama Toko</label>
              <input
                id="inputNamaToko"
                type="text"
                list="listNamaToko"
                className="input-field"
                placeholder="Ketik atau pilih nama toko FamilyMart..."
                value={namaToko}
                onChange={(e) => handleNamaTokoChange(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <datalist id="listKodeToko">
            {SAMPLE_STORES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.store}
              </option>
            ))}
          </datalist>

          <datalist id="listNamaToko">
            {SAMPLE_STORES.map((s) => (
              <option key={s.code} value={s.store}>
                {s.code} — {s.dc}
              </option>
            ))}
          </datalist>

          {/* INFO DETAIL TOKO OTOMATIS */}
          {selectedStore && (
            <div className="store-info-card">
              <div className="store-info-top">
                <div className="store-tags">
                  <span className="store-tag">
                    <i className="fa-solid fa-warehouse"></i> DC: {selectedStore.dc}
                  </span>
                  <span className="store-tag">
                    <i className="fa-solid fa-tag"></i> {selectedStore.type}
                  </span>
                  <span className="store-tag">
                    <i className="fa-solid fa-user"></i> PIC: {selectedStore.pic}
                  </span>
                </div>
                <button type="button" className="btn-reset-store" onClick={resetToko}>
                  <i className="fa-solid fa-rotate-left"></i> Ganti Toko
                </button>
              </div>
              <div className="store-address">
                <i className="fa-solid fa-location-dot" style={{ color: "#117b3d", marginTop: 2 }}></i>
                <span>{selectedStore.address}</span>
              </div>
            </div>
          )}
        </div>

        {/* BAGIAN 2: PILIH ITEM PESANAN */}
        <div className="section-block">
          <div className="section-header">
            <span className="step-badge">2</span>
            <h3>Silakan Pilih Item Pesanan Anda</h3>
          </div>
          <p className="section-hint">
            Kode Item dan Nama Item saling terhubung otomatis. Isi jumlah pesanan pada kolom Qty.
          </p>

          <div className="table-wrapper">
            <table className="order-table">
              <thead>
                <tr>
                  <th style={{ width: "48px" }}>No</th>
                  <th style={{ width: "130px" }}>Kode</th>
                  <th>Nama Item</th>
                  <th style={{ width: "115px" }}>Qty (Pcs)</th>
                  <th style={{ width: "56px" }}>Hapus</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="cell-no">{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        list="listKodeItem"
                        className="table-input table-input-code"
                        placeholder="Kode..."
                        value={row.kode}
                        onChange={(e) => handleKodeItemChange(idx, e.target.value)}
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        ref={(el) => {
                          namaInputRefs.current[row.id] = el;
                        }}
                        type="text"
                        list="listNamaItem"
                        className="table-input"
                        placeholder="Pilih atau ketik nama item..."
                        value={row.nama}
                        onChange={(e) => handleNamaItemChange(idx, e.target.value)}
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="table-input table-input-qty"
                        placeholder="0"
                        value={row.qty}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        onKeyDown={(e) => handleQtyKeyDown(e, idx)}
                      />
                    </td>
                    <td className="cell-action">
                      <button
                        type="button"
                        className="btn-remove-row"
                        title="Hapus baris ini"
                        onClick={() => hapusBaris(idx)}
                      >
                        <i className="fa-solid fa-minus"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id="listKodeItem">
            {SAMPLE_ITEMS.map((it) => (
              <option key={it.kode} value={it.kode}>
                {it.nama}
              </option>
            ))}
          </datalist>

          <datalist id="listNamaItem">
            {SAMPLE_ITEMS.map((it) => (
              <option key={it.kode} value={it.nama}>
                Kode: {it.kode}
              </option>
            ))}
          </datalist>

          <div className="table-footer-bar">
            <button
              type="button"
              className="btn-add-row"
              onClick={() => tambahBaris(true)}
            >
              <i className="fa-solid fa-plus"></i> Tambah Baris Item
            </button>

            <div className="summary-pills">
              <div className="summary-pill">
                Jenis Item: <strong>{validItems.length}</strong>
              </div>
              <div className="summary-pill">
                Total Qty: <strong>{totalQty.toLocaleString("id-ID")} Pcs</strong>
              </div>
            </div>
          </div>

          <div className="keyboard-tip">
            <i className="fa-regular fa-lightbulb" style={{ color: "#117b3d", marginRight: 6 }}></i>
            Tips: Klik <strong>Tambah Baris Item</strong> atau tekan tombol <strong>Enter</strong> pada kolom Qty untuk menambah baris baru.
          </div>
        </div>

        {/* BAGIAN 3: CATATAN & TOMBOL BUAT PESANAN */}
        <div className="order-submit-area">
          <div className="notes-box">
            <label htmlFor="inputCatatan">Catatan Tambahan (Opsional)</label>
            <input
              id="inputCatatan"
              type="text"
              className="input-field"
              placeholder="Contoh: Kirim bersama jadwal reguler / nama pemesan..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-submit-order">
            <i className="fa-solid fa-paper-plane"></i>
            Buat Pesanan
          </button>
        </div>
      </form>

      {/* FOOTER */}
      <div className="app-footer">
        <span>CV. Panen Raya Sukses Sejahtera &copy; 2026</span>
        <span>Portal Pemesanan FMI v1.0</span>
      </div>
    </>
  );
}
