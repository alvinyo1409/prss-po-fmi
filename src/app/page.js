"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabase";

const LOGO_URL =
  "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800";

const INITIAL_ROWS = [
  { id: "row-1", kode: "", nama: "", qty: "" },
  { id: "row-2", kode: "", nama: "", qty: "" },
];

export default function HomePage() {
  const [tanggalLabel, setTanggalLabel] = useState("");

  // State Data Master dari Supabase
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [masterError, setMasterError] = useState("");

  // State Toko (2 arah: Kode <-> Nama)
  const [kodeToko, setKodeToko] = useState("");
  const [namaToko, setNamaToko] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);

  // State Daftar Item Pesanan
  const [rows, setRows] = useState(INITIAL_ROWS);

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

  // Fetch Master Toko & Master Item dari Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadMasterData() {
      setLoadingMaster(true);
      setMasterError("");

      try {
        const res = await fetch("/api/master", { cache: "no-store" });
        const json = await res.json();

        if (res.ok && json.ok) {
          if (isMounted) {
            setStores(json.stores || []);
            setItems(json.items || []);
            setLoadingMaster(false);
          }
          return;
        }

        // Fallback langsung via client supabase jika API route gagal
        if (supabase) {
          const [tokoRes, itemRes] = await Promise.all([
            supabase
              .from("master_toko_fmi")
              .select("code, store, dc, type, city, address, pic, status")
              .order("store", { ascending: true }),
            supabase
              .from("master_item_fmi")
              .select("article, barcode, article_name, status")
              .order("article_name", { ascending: true }),
          ]);

          if (tokoRes.error) throw new Error(tokoRes.error.message);
          if (itemRes.error) throw new Error(itemRes.error.message);

          const mappedStores = (tokoRes.data || []).map((s) => ({
            code: String(s.code || "").trim(),
            store: String(s.store || "").trim(),
            dc: String(s.dc || "").trim(),
            type: String(s.type || "").trim(),
            city: String(s.city || "").trim(),
            address: String(s.address || "").trim(),
            pic: String(s.pic || "").trim(),
          }));

          const mappedItems = (itemRes.data || [])
            .filter((it) => {
              const st = String(it.status || "Active").trim().toLowerCase();
              return st === "active" || st === "aktif";
            })
            .map((it) => {
              const rawArticle = String(it.article || "").trim();
              const rawBarcode = String(it.barcode || "").trim();
              const displayKode =
                !rawArticle || rawArticle.toUpperCase() === "TBC" ? rawBarcode : rawArticle;
              return {
                kode: displayKode,
                article: rawArticle,
                barcode: rawBarcode,
                nama: String(it.article_name || "").trim(),
              };
            });

          if (isMounted) {
            setStores(mappedStores);
            setItems(mappedItems);
            setLoadingMaster(false);
          }
          return;
        }

        throw new Error(json.error || "Gagal memuat data master dari Supabase.");
      } catch (err) {
        if (isMounted) {
          setMasterError(err?.message || "Gagal memuat data dari Supabase.");
          setLoadingMaster(false);
        }
      }
    }

    loadMasterData();

    return () => {
      isMounted = false;
    };
  }, []);

  // --- Handler Pilih Toko (2 Arah) ---
  const handleKodeTokoChange = (val) => {
    setKodeToko(val);
    const clean = val.trim().toLowerCase();
    if (!clean) {
      setSelectedStore(null);
      return;
    }

    const match = stores.find((s) => {
      const sCode = s.code.toLowerCase();
      if (sCode === clean) return true;
      // Dukungan pencocokan kode angka dengan/tanpa leading zero (misal 134 vs 0134)
      if (/^\d+$/.test(clean) && /^\d+$/.test(sCode) && clean.length >= 3) {
        return Number(sCode) === Number(clean);
      }
      return false;
    });

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
    if (!clean) {
      setSelectedStore(null);
      return;
    }

    const match = stores.find((s) => s.store.toLowerCase() === clean);
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
    const match = items.find(
      (it) =>
        it.kode.toLowerCase() === clean ||
        (it.barcode && it.barcode.toLowerCase() === clean) ||
        (it.article && it.article.toLowerCase() !== "tbc" && it.article.toLowerCase() === clean)
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
    const match = items.find((it) => it.nama.toLowerCase() === clean);
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

  // --- Handler Tombol Buat Pesanan ---
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
      title: "Ringkasan Pesanan Toko",
      html: `
        <div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;">
          <div><strong>Toko:</strong> ${selectedStore ? selectedStore.code : kodeToko} — ${selectedStore ? selectedStore.store : namaToko}</div>
          ${selectedStore ? `<div><strong>DC / PIC:</strong> ${selectedStore.dc} / ${selectedStore.pic}</div>` : ""}
        </div>
        <div style="max-height:200px;overflow-y:auto;margin-bottom:12px;">${daftarHtml}</div>
        <div style="font-size:14px;font-weight:bold;color:#0e6231;text-align:right;">
          Total: ${validItems.length} Jenis Item (${totalQty.toLocaleString("id-ID")} Pcs)
        </div>
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

        {/* INDIKATOR KONEKSI DATABASE SUPABASE */}
        {loadingMaster && (
          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#0e6231",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span>Memuat database Toko &amp; Item FamilyMart dari Supabase...</span>
          </div>
        )}

        {!loadingMaster && masterError && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "18px",
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>
            {masterError}
          </div>
        )}

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
                placeholder={loadingMaster ? "Memuat..." : "Contoh: 0463"}
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
                placeholder={
                  loadingMaster
                    ? "Memuat daftar toko..."
                    : `Ketik atau pilih nama toko (${stores.length} toko)...`
                }
                value={namaToko}
                onChange={(e) => handleNamaTokoChange(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <datalist id="listKodeToko">
            {stores.map((s) => (
              <option key={s.code} value={s.code}>
                {s.store}
              </option>
            ))}
          </datalist>

          <datalist id="listNamaToko">
            {stores.map((s) => (
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
                  {selectedStore.dc && (
                    <span className="store-tag">
                      <i className="fa-solid fa-warehouse"></i> DC: {selectedStore.dc}
                    </span>
                  )}
                  {selectedStore.type && (
                    <span className="store-tag">
                      <i className="fa-solid fa-tag"></i> {selectedStore.type}
                    </span>
                  )}
                  {selectedStore.pic && (
                    <span className="store-tag">
                      <i className="fa-solid fa-user"></i> PIC: {selectedStore.pic}
                    </span>
                  )}
                </div>
                <button type="button" className="btn-reset-store" onClick={resetToko}>
                  <i className="fa-solid fa-rotate-left"></i> Ganti Toko
                </button>
              </div>
              {selectedStore.address && (
                <div className="store-address">
                  <i
                    className="fa-solid fa-location-dot"
                    style={{ color: "#117b3d", marginTop: 2 }}
                  ></i>
                  <span>{selectedStore.address}</span>
                </div>
              )}
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
                    <td className="cell-kode">
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
                    <td className="cell-nama">
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
                    <td className="cell-qty">
                      <input
                        type="number"
                        inputMode="numeric"
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
            {items.map((it) => (
              <option key={`${it.kode}-${it.barcode}`} value={it.kode}>
                {it.nama}
              </option>
            ))}
          </datalist>

          <datalist id="listNamaItem">
            {items.map((it) => (
              <option key={`${it.kode}-${it.barcode}`} value={it.nama}>
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

        {/* BAGIAN 3: TOMBOL BUAT PESANAN */}
        <div className="order-submit-area">
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
