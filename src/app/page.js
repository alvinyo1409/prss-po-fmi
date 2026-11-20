"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabase";

const LOGO_URL =
  "https://drive.google.com/thumbnail?id=18ZvGPp6CImwAiFTRBfIBBgj0O5G6plVq&sz=w800";

const INITIAL_ROWS = [
  { id: "row-1", kode: "", nama: "", qty: "" },
  { id: "row-2", kode: "", nama: "", qty: "" },
];

// Pola deteksi upaya injeksi function / script / SQL berbahaya
const MALICIOUS_INPUT_REGEX =
  /(<\s*\/?\s*script|javascript\s*:|on\w+\s*=|\bfunction\s*\(|=>|\beval\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|\bFunction\s*\(|\bdocument\.|\bwindow\.|\balert\s*\(|\bSELECT\b.+\bFROM\b|\bDROP\s+TABLE\b|\bUNION\s+SELECT\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|[<>{};`$\\])/i;

function isMaliciousString(val) {
  if (!val) return false;
  return MALICIOUS_INPUT_REGEX.test(String(val));
}

// Sanitasi karakter: Kode hanya boleh huruf & angka
function sanitizeCode(val) {
  return String(val || "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 25);
}

// Sanitasi karakter: Nama Toko / Item hanya boleh karakter nama wajar (tanpa simbol script/kode)
function sanitizeName(val) {
  return String(val || "")
    .replace(/[<>{}[\];=`$"\\]/g, "")
    .slice(0, 120);
}

// Sanitasi karakter: Qty hanya boleh angka bulat positif 0-9 (maks 5 digit = 99999)
function sanitizeQty(val) {
  const digitsOnly = String(val || "").replace(/[^0-9]/g, "").slice(0, 5);
  if (!digitsOnly) return "";
  return String(Number(digitsOnly));
}

function formatTanggalOrder(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function HomePage() {
  const [tanggalLabel, setTanggalLabel] = useState("");

  // Mode tampilan: "form" (Buat Pesanan) | "list" (Check Pesanan)
  const [activeView, setActiveView] = useState("form");

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
  const [submitting, setSubmitting] = useState(false);

  // State Daftar Pesanan (Check Pesanan)
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [searchOrder, setSearchOrder] = useState("");

  // Ref counter ID baris & auto-fokus input baris baru saat tekan Enter
  const nextRowIdRef = useRef(3);
  const namaInputRefs = useRef({});
  const lastSecurityWarnRef = useRef(0);

  const showSecurityWarning = useCallback(() => {
    const now = Date.now();
    if (now - lastSecurityWarnRef.current < 1500) return;
    lastSecurityWarnRef.current = now;
    Swal.fire({
      icon: "error",
      title: "Input Diblokir Sistem Keamanan",
      text: "Tidak diizinkan memasukkan function, script, atau simbol kode berbahaya ke dalam kotak isian.",
      confirmButtonColor: "#dc2626",
    });
  }, []);

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

  // Fungsi memuat daftar pesanan dari Supabase (Check Pesanan)
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError("");

    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const json = await res.json();

      if (res.ok && json.ok) {
        setOrders(json.orders || []);
        setLoadingOrders(false);
        return;
      }

      throw new Error(json.error || "Gagal memuat daftar pesanan.");
    } catch (err) {
      setOrdersError(err?.message || "Gagal memuat daftar pesanan.");
      setLoadingOrders(false);
    }
  }, []);

  const bukaCheckPesanan = () => {
    setActiveView("list");
    loadOrders();
  };

  // --- Helper Pencocokan Master Toko & Item ---
  const findStoreByCode = useCallback(
    (codeVal) => {
      const clean = String(codeVal || "").trim().toLowerCase();
      if (!clean) return null;
      return (
        stores.find((s) => {
          const sCode = s.code.toLowerCase();
          if (sCode === clean) return true;
          if (/^\d+$/.test(clean) && /^\d+$/.test(sCode) && clean.length >= 3) {
            return Number(sCode) === Number(clean);
          }
          return false;
        }) || null
      );
    },
    [stores]
  );

  const findStoreByName = useCallback(
    (nameVal) => {
      const clean = String(nameVal || "").trim().toLowerCase();
      if (!clean) return null;
      return stores.find((s) => s.store.toLowerCase() === clean) || null;
    },
    [stores]
  );

  const findItemByCode = useCallback(
    (codeVal) => {
      const clean = String(codeVal || "").trim().toLowerCase();
      if (!clean) return null;
      return (
        items.find(
          (it) =>
            it.kode.toLowerCase() === clean ||
            (it.barcode && it.barcode.toLowerCase() === clean) ||
            (it.article && it.article.toLowerCase() !== "tbc" && it.article.toLowerCase() === clean)
        ) || null
      );
    },
    [items]
  );

  const findItemByName = useCallback(
    (nameVal) => {
      const clean = String(nameVal || "").trim().toLowerCase();
      if (!clean) return null;
      return items.find((it) => it.nama.toLowerCase() === clean) || null;
    },
    [items]
  );

  // --- Handler Pilih Toko (2 Arah + Proteksi Anti-Injeksi) ---
  const handleKodeTokoChange = (rawVal) => {
    if (isMaliciousString(rawVal)) {
      showSecurityWarning();
      return;
    }
    const val = sanitizeCode(rawVal);
    setKodeToko(val);

    const match = findStoreByCode(val);
    if (match) {
      setNamaToko(match.store);
      setSelectedStore(match);
    } else {
      setSelectedStore(null);
    }
  };

  const handleNamaTokoChange = (rawVal) => {
    if (isMaliciousString(rawVal)) {
      showSecurityWarning();
      return;
    }
    const val = sanitizeName(rawVal);
    setNamaToko(val);

    const match = findStoreByName(val);
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

  // --- Handler Baris Item (2 Arah + Proteksi Anti-Injeksi) ---
  const handleKodeItemChange = (idx, rawVal) => {
    if (isMaliciousString(rawVal)) {
      showSecurityWarning();
      return;
    }
    const val = sanitizeCode(rawVal);
    const match = findItemByCode(val);

    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          kode: match ? match.kode : val,
          nama: match ? match.nama : row.nama,
        };
      })
    );
  };

  const handleNamaItemChange = (idx, rawVal) => {
    if (isMaliciousString(rawVal)) {
      showSecurityWarning();
      return;
    }
    const val = sanitizeName(rawVal);
    const match = findItemByName(val);

    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          nama: match ? match.nama : val,
          kode: match ? match.kode : row.kode,
        };
      })
    );
  };

  const handleQtyChange = (idx, rawVal) => {
    if (isMaliciousString(rawVal)) {
      showSecurityWarning();
      return;
    }
    const cleanQty = sanitizeQty(rawVal);
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, qty: cleanQty } : row)));
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
    // Blokir karakter non-angka bulat pada input number (e, E, +, -, ., ,)
    if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
      e.preventDefault();
      return;
    }
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

  // --- Evaluasi Status Validasi Toko & Baris Item (Untuk Box Merah & Lock Supabase) ---
  const isKodeTokoInvalid =
    !loadingMaster && kodeToko.trim() !== "" && !findStoreByCode(kodeToko);
  const isNamaTokoInvalid =
    !loadingMaster && namaToko.trim() !== "" && !findStoreByName(namaToko);
  const isStoreMismatch =
    !loadingMaster &&
    !selectedStore &&
    (kodeToko.trim() !== "" || namaToko.trim() !== "");

  const rowValidations = rows.map((row, idx) => {
    const kTrim = row.kode.trim();
    const nTrim = row.nama.trim();
    const qTrim = String(row.qty || "").trim();
    const isEmpty = kTrim === "" && nTrim === "" && (qTrim === "" || qTrim === "0");

    const matchByCode = kTrim ? findItemByCode(kTrim) : null;
    const matchByName = nTrim ? findItemByName(nTrim) : null;

    const kodeInvalid = !loadingMaster && kTrim !== "" && !matchByCode;
    const namaInvalid = !loadingMaster && nTrim !== "" && !matchByName;
    // Pastikan kode & nama pada baris tersebut menunjuk ke 1 item yang sama di Supabase
    const pairMismatch =
      !loadingMaster &&
      kTrim !== "" &&
      nTrim !== "" &&
      matchByCode &&
      matchByName &&
      matchByCode.kode !== matchByName.kode;

    const isItemLockedValid =
      Boolean(matchByCode) &&
      Boolean(matchByName) &&
      matchByCode.kode === matchByName.kode;

    const qtyNum = Number(qTrim);
    const isQtyValid = Number.isInteger(qtyNum) && qtyNum > 0 && qtyNum <= 99999;

    return {
      idx,
      isEmpty,
      kodeInvalid: kodeInvalid || pairMismatch,
      namaInvalid: namaInvalid || pairMismatch,
      pairMismatch,
      isItemLockedValid,
      isQtyValid,
      matchedItem: isItemLockedValid ? matchByCode : null,
    };
  });

  const invalidItemRows = rowValidations.filter(
    (v) => !v.isEmpty && (v.kodeInvalid || v.namaInvalid)
  );

  // Hitung ringkasan aktif hanya dari baris yang itemnya 100% valid di Supabase & Qty > 0
  const validItems = rows.filter((_, i) => {
    const v = rowValidations[i];
    return v && v.isItemLockedValid && v.isQtyValid;
  });
  const totalQty = validItems.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);

  // --- Handler Tombol Buat Pesanan (Simpan ke Supabase dengan Validasi Ketat) ---
  const handleBuatPesanan = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // 1. Pastikan Toko wajib terdaftar & terpilih dari master_toko_fmi Supabase
    if (!selectedStore || isKodeTokoInvalid || isNamaTokoInvalid) {
      Swal.fire({
        icon: "error",
        title: "Toko Tidak Valid!",
        text: "Kode Toko atau Nama Toko yang Anda ketik tidak terdaftar di database Supabase. Silakan pilih dari daftar rekomendasi yang tersedia.",
        confirmButtonColor: "#dc2626",
      });
      return;
    }

    // 2. Pastikan tidak ada baris item yang berwarna merah (di luar database master_item_fmi)
    if (invalidItemRows.length > 0) {
      const nomorBaris = invalidItemRows.map((v) => `Baris #${v.idx + 1}`).join(", ");
      Swal.fire({
        icon: "error",
        title: "Item Tidak Terdaftar di Database!",
        html: `Terdapat input item di luar daftar rekomendasi Supabase pada <strong>${nomorBaris}</strong> (ditandai kotak merah).<br/><br/>Silakan pilih Kode / Nama Item yang tersedia di rekomendasi atau hapus baris tersebut.`,
        confirmButtonColor: "#dc2626",
      });
      return;
    }

    // 3. Cek apakah ada baris yang sudah diisi sebagian tapi belum lengkap (misal pilih item tapi Qty 0, atau isi Qty tapi belum pilih item)
    const incompleteRow = rowValidations.find(
      (v) => !v.isEmpty && (!v.isItemLockedValid || !v.isQtyValid)
    );
    if (incompleteRow) {
      Swal.fire({
        icon: "warning",
        title: `Data Baris #${incompleteRow.idx + 1} Belum Lengkap`,
        text: !incompleteRow.isItemLockedValid
          ? `Pada Baris #${incompleteRow.idx + 1}, pastikan Kode Item dan Nama Item sudah dipilih dari rekomendasi.`
          : `Pada Baris #${incompleteRow.idx + 1}, harap isi jumlah Qty (minimal 1 Pcs).`,
        confirmButtonColor: "#008a41",
      });
      return;
    }

    if (validItems.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Daftar Item Kosong",
        text: "Harap pilih minimal 1 item dari rekomendasi dan isi jumlah Qty lebih dari 0.",
        confirmButtonColor: "#008a41",
      });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_toko: selectedStore.code,
          nama_toko: selectedStore.store,
          items: validItems.map((it) => ({
            kode: it.kode.trim(),
            nama: it.nama.trim(),
            qty: Number(it.qty) || 0,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Gagal menyimpan pesanan ke database.");
      }

      const savedOrder = json.order;

      // Reset form setelah berhasil tersimpan agar tidak terinput ganda
      resetToko();
      setRows([buatBarisBaru(), buatBarisBaru()]);

      const result = await Swal.fire({
        icon: "success",
        title: "Pesanan Berhasil Terinput!",
        html: `
          <div style="margin:10px 0 14px 0;padding:14px;background:#f0fdf4;border:2px dashed #008a41;border-radius:10px;text-align:center;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:bold;">
              Nomor Pesanan Anda
            </div>
            <div style="font-size:22px;font-weight:bold;color:#0a66c2;font-family:monospace;margin-top:4px;letter-spacing:0.8px;">
              ${escapeHtml(savedOrder.no_order)}
            </div>
          </div>
          <div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px;line-height:1.6;">
            <div><strong>Toko:</strong> ${escapeHtml(savedOrder.kode_toko)} — ${escapeHtml(savedOrder.nama_toko)}</div>
            <div><strong>Total Pesanan:</strong> ${Number(savedOrder.total_jenis_item)} Jenis Item (${Number(savedOrder.total_qty).toLocaleString("id-ID")} Pcs)</div>
            <div><strong>Status:</strong> <span style="color:#0a66c2;font-weight:bold;">${escapeHtml(savedOrder.status)}</span></div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-clipboard-check"></i> Check Pesanan',
        cancelButtonText: "Tutup",
        confirmButtonColor: "#008a41",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
      });

      if (result.isConfirmed) {
        bukaCheckPesanan();
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal Menyimpan Pesanan",
        text: err?.message || "Terjadi kendala saat menyimpan pesanan.",
        confirmButtonColor: "#008a41",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // --- Handler Lihat Detail Pesanan (100% View-Only) ---
  const handleLihatDetailPesanan = (ord) => {
    const storeInfo = ord.store_detail || findStoreByCode(ord.kode_toko);
    const itemsList = Array.isArray(ord.items) ? ord.items : [];

    const rowsHtml = itemsList
      .map(
        (it, idx) => `
          <tr>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:center;color:#64748b;font-weight:bold;">${idx + 1}</td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:bold;color:#0a66c2;">${escapeHtml(it.kode || "-")}</td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:left;color:#1e293b;">${escapeHtml(it.nama || "-")}</td>
            <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;font-family:monospace;color:#0f172a;white-space:nowrap;">${Number(it.qty || 0).toLocaleString("id-ID")} Pcs</td>
          </tr>
        `
      )
      .join("");

    Swal.fire({
      title: `Detail Pesanan ${ord.no_order}`,
      width: 640,
      html: `
        <div style="text-align:left;font-size:13px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #008a41;border-radius:8px;padding:12px 14px;margin-bottom:14px;line-height:1.6;">
            <div><strong>No. Order:</strong> <span style="font-family:monospace;font-weight:bold;color:#0a66c2;">${escapeHtml(ord.no_order)}</span></div>
            <div><strong>Tanggal Input:</strong> ${escapeHtml(formatTanggalOrder(ord.tanggal))}</div>
            <div><strong>Toko:</strong> ${escapeHtml(ord.kode_toko)} — ${escapeHtml(ord.nama_toko)}</div>
            ${storeInfo?.dc ? `<div><strong>DC / Tipe:</strong> ${escapeHtml(storeInfo.dc)}${storeInfo.type ? ` (${escapeHtml(storeInfo.type)})` : ""}</div>` : ""}
            ${storeInfo?.pic ? `<div><strong>PIC Toko:</strong> ${escapeHtml(storeInfo.pic)}</div>` : ""}
            ${storeInfo?.address ? `<div><strong>Alamat:</strong> ${escapeHtml(storeInfo.address)}</div>` : ""}
            <div><strong>Status:</strong> <span style="background:#e6f3ff;color:#0a66c2;border:1px solid #9fd0f7;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${escapeHtml(ord.status)}</span></div>
          </div>

          <div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;max-height:260px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#0a66c2;color:#ffffff;">
                  <th style="padding:8px;text-align:center;width:40px;">No</th>
                  <th style="padding:8px;text-align:left;width:95px;">Kode</th>
                  <th style="padding:8px;text-align:left;">Nama Item</th>
                  <th style="padding:8px;text-align:right;width:90px;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#64748b;">Tidak ada rincian item</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:flex-end;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;font-weight:bold;color:#0a66c2;">
            <span>Total: ${Number(ord.total_jenis_item)} Item (${Number(ord.total_qty).toLocaleString("id-ID")} Pcs)</span>
          </div>
        </div>
      `,
      confirmButtonText: "Tutup",
      confirmButtonColor: "#008a41",
    });
  };

  // Filter pencarian di halaman Check Pesanan (dengan sanitasi)
  const handleSearchOrderChange = (rawVal) => {
    if (isMaliciousString(rawVal)) {
      showSecurityWarning();
      return;
    }
    setSearchOrder(sanitizeName(rawVal));
  };

  const filteredOrders = orders.filter((ord) => {
    const q = searchOrder.trim().toLowerCase();
    if (!q) return true;
    return (
      String(ord.no_order || "").toLowerCase().includes(q) ||
      String(ord.kode_toko || "").toLowerCase().includes(q) ||
      String(ord.nama_toko || "").toLowerCase().includes(q) ||
      String(ord.status || "").toLowerCase().includes(q)
    );
  });

  const isStatusCompleted = (st) => {
    const clean = String(st || "").toLowerCase();
    return clean.includes("terkirim") || clean.includes("selesai") || clean.includes("dikirim");
  };

  return (
    <>
      {/* HEADER LOGO & BRAND */}
      <div className="brand-hero">
        <div className="brand-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="Logo Panen Raya" className="company-logo" />
          <span className="brand-divider" aria-hidden="true"></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/familymart-logo.png" alt="Logo FamilyMart" className="familymart-logo" />
        </div>
        <h1>CV. Panen Raya Sukses Sejahtera</h1>
        <p className="sub-title">Portal Pemesanan Produk — Mitra Toko FamilyMart</p>
      </div>

      {/* KARTU UTAMA */}
      <div className="order-card">
        <div className="card-welcome">
          <div>
            <h2>
              <i
                className={
                  activeView === "form"
                    ? "fa-solid fa-cart-shopping"
                    : "fa-solid fa-clipboard-list"
                }
              ></i>
              {activeView === "form"
                ? "Formulir Pemesanan Toko"
                : "Daftar & Status Pesanan Toko"}
            </h2>
            {activeView === "form" && (
              <p className="card-welcome-sub">
                Selamat datang! Silakan pilih identitas toko dan daftar item yang ingin dipesan.
              </p>
            )}
          </div>

          <div className="header-actions">
            {tanggalLabel && (
              <span className="date-badge">
                <i className="fa-regular fa-calendar"></i>
                {tanggalLabel}
              </span>
            )}

            {activeView === "form" ? (
              <button
                type="button"
                className="btn-nav-action"
                onClick={bukaCheckPesanan}
              >
                <i className="fa-solid fa-clipboard-check"></i>
                Check Pesanan
              </button>
            ) : (
              <button
                type="button"
                className="btn-nav-action btn-nav-secondary"
                onClick={() => setActiveView("form")}
              >
                <i className="fa-solid fa-plus"></i>
                Buat Pesanan Baru
              </button>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAMPILAN 1: FORMULIR PEMESANAN TOKO                          */}
        {/* ============================================================ */}
        {activeView === "form" && (
          <form onSubmit={handleBuatPesanan}>
            {loadingMaster && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#0a66c2",
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
                Ketik untuk mencari, lalu pilih Kode Toko atau Nama Toko dari rekomendasi yang muncul.
              </p>

              <div className="store-grid">
                <div className="field-group">
                  <label htmlFor="inputKodeToko">Kode Toko</label>
                  <input
                    id="inputKodeToko"
                    type="text"
                    list="listKodeToko"
                    className={`input-field input-field-code ${
                      isKodeTokoInvalid ? "input-field-error" : ""
                    }`}
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
                    className={`input-field ${isNamaTokoInvalid ? "input-field-error" : ""}`}
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

              {/* PERINGATAN BOX MERAH JIKA INPUT TOKO DI LUAR REKOMENDASI SUPABASE */}
              {isStoreMismatch && (
                <div className="store-error-card">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>
                    Kode atau Nama Toko tidak terdaftar di database Supabase! Wajib memilih dari
                    daftar rekomendasi yang muncul.
                  </span>
                </div>
              )}

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
                        style={{ color: "#008a41", marginTop: 2 }}
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
                Ketik dan pilih Kode Item atau Nama Item dari rekomendasi Supabase, lalu isi jumlah Qty.
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
                    {rows.map((row, idx) => {
                      const v = rowValidations[idx];
                      const hasRowErr = v && (v.kodeInvalid || v.namaInvalid);

                      return (
                        <tr key={row.id} className={hasRowErr ? "row-item-error" : ""}>
                          <td className="cell-no">{idx + 1}</td>
                          <td className="cell-kode">
                            <input
                              type="text"
                              list="listKodeItem"
                              className={`table-input table-input-code ${
                                v?.kodeInvalid ? "table-input-error" : ""
                              }`}
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
                              className={`table-input ${
                                v?.namaInvalid ? "table-input-error" : ""
                              }`}
                              placeholder="Pilih atau ketik nama item..."
                              value={row.nama}
                              onChange={(e) => handleNamaItemChange(idx, e.target.value)}
                              autoComplete="off"
                            />
                          </td>
                          <td className="cell-qty">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="table-input table-input-qty"
                              placeholder="0"
                              value={row.qty}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              onKeyDown={(e) => handleQtyKeyDown(e, idx)}
                              autoComplete="off"
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
                      );
                    })}
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

              {/* PERINGATAN BOX MERAH JIKA ADA BARIS ITEM DI LUAR REKOMENDASI SUPABASE */}
              {invalidItemRows.length > 0 && (
                <div className="store-error-card">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>
                    Peringatan pada{" "}
                    {invalidItemRows.map((v) => `Baris #${v.idx + 1}`).join(", ")}: Kode atau Nama
                    Item tidak terdaftar di database Supabase! Wajib memilih dari daftar
                    rekomendasi.
                  </span>
                </div>
              )}

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
                <i
                  className="fa-regular fa-lightbulb"
                  style={{ color: "#008a41", marginRight: 6 }}
                ></i>
                Tips: Klik <strong>Tambah Baris Item</strong> atau tekan tombol{" "}
                <strong>Enter</strong> pada kolom Qty untuk menambah baris baru.
              </div>
            </div>

            {/* BAGIAN 3: TOMBOL BUAT PESANAN */}
            <div className="order-submit-area">
              <button type="submit" className="btn-submit-order" disabled={submitting}>
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Menyimpan Pesanan...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Buat Pesanan
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAMPILAN 2: CHECK PESANAN (DAFTAR PESANAN VIEW-ONLY)         */}
        {/* ============================================================ */}
        {activeView === "list" && (
          <div>
            <div className="orders-toolbar">
              <input
                type="text"
                className="orders-search-input"
                placeholder="Cari No. Order, Kode Toko, atau Nama Toko..."
                value={searchOrder}
                onChange={(e) => handleSearchOrderChange(e.target.value)}
              />
              <button
                type="button"
                className="btn-refresh-orders"
                onClick={loadOrders}
                disabled={loadingOrders}
              >
                <i
                  className={`fa-solid fa-arrows-rotate ${loadingOrders ? "fa-spin" : ""}`}
                ></i>
                Refresh
              </button>
            </div>

            {ordersError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>
                {ordersError}
              </div>
            )}

            <div className="table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: "155px" }}>No. Order</th>
                    <th style={{ width: "145px" }}>Tanggal</th>
                    <th style={{ width: "95px" }}>Kode Toko</th>
                    <th>Nama Toko</th>
                    <th style={{ width: "225px" }}>Status</th>
                    <th style={{ width: "115px" }}>Rincian</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOrders ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "28px",
                          textAlign: "center",
                          color: "#64748b",
                          justifyContent: "center",
                        }}
                      >
                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                        Memuat daftar pesanan...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "28px",
                          textAlign: "center",
                          color: "#64748b",
                          justifyContent: "center",
                        }}
                      >
                        Belum ada data pesanan yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id || ord.no_order}>
                        <td data-label="No. Order">
                          <span className="order-no-badge">{ord.no_order}</span>
                        </td>
                        <td data-label="Tanggal" style={{ fontSize: "12px", color: "#475569" }}>
                          {formatTanggalOrder(ord.tanggal)}
                        </td>
                        <td
                          data-label="Kode Toko"
                          style={{ fontFamily: "monospace", fontWeight: "bold" }}
                        >
                          {ord.kode_toko}
                        </td>
                        <td data-label="Nama Toko" style={{ fontWeight: 600 }}>
                          {ord.nama_toko}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`status-badge ${
                              isStatusCompleted(ord.status)
                                ? "status-badge-done"
                                : "status-badge-pending"
                            }`}
                          >
                            <i
                              className={
                                isStatusCompleted(ord.status)
                                  ? "fa-solid fa-circle-check"
                                  : "fa-regular fa-clock"
                              }
                            ></i>
                            {ord.status}
                          </span>
                        </td>
                        <td data-label="Rincian">
                          <button
                            type="button"
                            className="btn-view-detail"
                            onClick={() => handleLihatDetailPesanan(ord)}
                          >
                            <i className="fa-regular fa-eye"></i> Lihat Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="app-footer">
        <span>CV. Panen Raya Sukses Sejahtera &copy; 2026</span>
        <span>Portal Pemesanan FMI v1.0</span>
      </div>
    </>
  );
}
