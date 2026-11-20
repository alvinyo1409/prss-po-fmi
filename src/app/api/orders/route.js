import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function normalizeCode(val) {
  return String(val || "").trim().toLowerCase();
}

// Deteksi pola injeksi script / function / SQL berbahaya
const INJECTION_PATTERN =
  /(<\s*\/?\s*script|javascript\s*:|on\w+\s*=|\bfunction\s*\(|=>|\beval\s*\(|\bsetTimeout\s*\(|\bsetInterval\s*\(|\bFunction\s*\(|\bdocument\.|\bwindow\.|\balert\s*\(|\bSELECT\b.+\bFROM\b|\bDROP\s+TABLE\b|\bUNION\s+SELECT\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|[<>{};`$\\])/i;

function hasMaliciousInput(val) {
  if (val === null || val === undefined) return false;
  return INJECTION_PATTERN.test(String(val));
}

export async function GET() {
  try {
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : supabase;

    if (!db) {
      return NextResponse.json(
        { ok: false, error: "Koneksi Supabase belum dikonfigurasi." },
        { status: 500 }
      );
    }

    const [ordersRes, storesRes] = await Promise.all([
      db
        .from("pesanan_fmi")
        .select(
          "id, no_order, tanggal, kode_toko, nama_toko, items, total_jenis_item, total_qty, status, created_at"
        )
        .order("id", { ascending: false })
        .limit(300),
      db
        .from("master_toko_fmi")
        .select("code, store, dc, type, city, address, pic"),
    ]);

    if (ordersRes.error) {
      return NextResponse.json(
        { ok: false, error: `Gagal memuat daftar pesanan: ${ordersRes.error.message}` },
        { status: 500 }
      );
    }

    // Buat kamus lookup detail toko berdasarkan kode_toko (Primary/Foreign Key)
    const storeMap = new Map();
    const storeNumMap = new Map();
    for (const s of storesRes.data || []) {
      const c = normalizeCode(s.code);
      if (!c) continue;
      const detail = {
        code: String(s.code || "").trim(),
        store: String(s.store || "").trim(),
        dc: String(s.dc || "").trim(),
        type: String(s.type || "").trim(),
        city: String(s.city || "").trim(),
        address: String(s.address || "").trim(),
        pic: String(s.pic || "").trim(),
      };
      storeMap.set(c, detail);
      if (/^\d+$/.test(c)) {
        storeNumMap.set(Number(c), detail);
      }
    }

    const orders = (ordersRes.data || []).map((ord) => {
      const c = normalizeCode(ord.kode_toko);
      const storeDetail =
        storeMap.get(c) ||
        (/^\d+$/.test(c) ? storeNumMap.get(Number(c)) : null) ||
        null;

      return {
        id: ord.id,
        no_order: ord.no_order,
        tanggal: ord.tanggal || ord.created_at,
        kode_toko: ord.kode_toko,
        nama_toko: storeDetail?.store || ord.nama_toko,
        status: ord.status || "Pesanan Diterima, Menunggu Pengiriman",
        total_jenis_item: Number(ord.total_jenis_item) || 0,
        total_qty: Number(ord.total_qty) || 0,
        items: Array.isArray(ord.items) ? ord.items : [],
        store_detail: storeDetail,
      };
    });

    return NextResponse.json({
      ok: true,
      orders,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : supabase;

    if (!db) {
      return NextResponse.json(
        { ok: false, error: "Koneksi Supabase belum dikonfigurasi." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const kodeTokoInput = String(body.kode_toko || "").trim();
    const namaTokoInput = String(body.nama_toko || "").trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    // 1. Proteksi Keamanan Anti-Injeksi Function / Script
    if (hasMaliciousInput(kodeTokoInput) || hasMaliciousInput(namaTokoInput)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Terdeteksi karakter atau potongan function/script tidak sah pada input Toko.",
        },
        { status: 400 }
      );
    }

    for (const it of rawItems) {
      if (
        hasMaliciousInput(it?.kode) ||
        hasMaliciousInput(it?.nama) ||
        hasMaliciousInput(it?.qty)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Terdeteksi karakter atau potongan function/script tidak sah pada baris Item.",
          },
          { status: 400 }
        );
      }
    }

    if (!kodeTokoInput || !namaTokoInput) {
      return NextResponse.json(
        { ok: false, error: "Kode Toko dan Nama Toko wajib dipilih dari database." },
        { status: 400 }
      );
    }

    // 2. Ambil Master Toko & Master Item resmi dari Supabase untuk validasi Whitelist
    const [tokoRes, itemRes] = await Promise.all([
      db
        .from("master_toko_fmi")
        .select("code, store, status"),
      db
        .from("master_item_fmi")
        .select("article, barcode, article_name, status"),
    ]);

    if (tokoRes.error || itemRes.error) {
      return NextResponse.json(
        { ok: false, error: "Gagal memverifikasi database master Supabase." },
        { status: 500 }
      );
    }

    // Verifikasi Toko wajib terdaftar di master_toko_fmi
    const cleanKodeToko = kodeTokoInput.toLowerCase();
    const cleanNamaToko = namaTokoInput.toLowerCase();

    const matchedStore = (tokoRes.data || []).find((s) => {
      const sCode = String(s.code || "").trim().toLowerCase();
      const sStore = String(s.store || "").trim().toLowerCase();
      const codeMatch =
        sCode === cleanKodeToko ||
        (/^\d+$/.test(cleanKodeToko) &&
          /^\d+$/.test(sCode) &&
          Number(sCode) === Number(cleanKodeToko));
      return codeMatch && sStore === cleanNamaToko;
    });

    if (!matchedStore) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Toko yang diinput tidak terdaftar di database Supabase. Wajib memilih dari daftar rekomendasi.",
        },
        { status: 400 }
      );
    }

    // Siapkan daftar item Active resmi dari master_item_fmi
    const activeMasterItems = (itemRes.data || [])
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

    // Verifikasi setiap baris item wajib cocok dengan master_item_fmi dan Qty berupa bilangan bulat positif
    const verifiedItems = [];

    for (let i = 0; i < rawItems.length; i += 1) {
      const row = rawItems[i];
      const k = String(row?.kode || "").trim().toLowerCase();
      const n = String(row?.nama || "").trim().toLowerCase();
      const qStr = String(row?.qty ?? "").trim();

      if (!k && !n && (!qStr || qStr === "0")) {
        continue;
      }

      if (!/^\d+$/.test(qStr)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Baris item ke-${i + 1}: Qty harus berupa angka bulat positif yang valid.`,
          },
          { status: 400 }
        );
      }

      const qtyNum = Number(qStr);
      if (!Number.isInteger(qtyNum) || qtyNum <= 0 || qtyNum > 99999) {
        return NextResponse.json(
          {
            ok: false,
            error: `Baris item ke-${i + 1}: Qty harus bernilai antara 1 hingga 99.999 Pcs.`,
          },
          { status: 400 }
        );
      }

      const matchedItem = activeMasterItems.find((m) => {
        const codeMatches =
          m.kode.toLowerCase() === k ||
          (m.barcode && m.barcode.toLowerCase() === k) ||
          (m.article && m.article.toLowerCase() !== "tbc" && m.article.toLowerCase() === k);
        const nameMatches = m.nama.toLowerCase() === n;
        return codeMatches && nameMatches;
      });

      if (!matchedItem) {
        return NextResponse.json(
          {
            ok: false,
            error: `Baris item ke-${i + 1} (${row?.kode || ""} ${row?.nama || ""}) tidak terdaftar di database Supabase. Wajib pilih dari daftar rekomendasi.`,
          },
          { status: 400 }
        );
      }

      verifiedItems.push({
        kode: matchedItem.kode,
        nama: matchedItem.nama,
        qty: qtyNum,
      });
    }

    if (verifiedItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Minimal harus ada 1 item pesanan yang valid dengan Qty lebih dari 0." },
        { status: 400 }
      );
    }

    const totalJenisItem = verifiedItems.length;
    const totalQty = verifiedItems.reduce((sum, it) => sum + it.qty, 0);

    // 3. Simpan menggunakan nilai resmi dari master Supabase
    const { data, error } = await db
      .from("pesanan_fmi")
      .insert([
        {
          kode_toko: String(matchedStore.code).trim(),
          nama_toko: String(matchedStore.store).trim(),
          items: verifiedItems,
          total_jenis_item: totalJenisItem,
          total_qty: totalQty,
          status: "Pesanan Diterima, Menunggu Pengiriman",
        },
      ])
      .select(
        "id, no_order, tanggal, kode_toko, nama_toko, items, total_jenis_item, total_qty, status, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Gagal menyimpan pesanan: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      order: data,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Terjadi kesalahan saat menyimpan pesanan." },
      { status: 500 }
    );
  }
}
