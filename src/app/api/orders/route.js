import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function normalizeCode(val) {
  return String(val || "").trim().toLowerCase();
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
    const kodeToko = String(body.kode_toko || "").trim();
    const namaToko = String(body.nama_toko || "").trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!kodeToko || !namaToko) {
      return NextResponse.json(
        { ok: false, error: "Kode Toko dan Nama Toko wajib dipilih." },
        { status: 400 }
      );
    }

    const cleanItems = rawItems
      .map((it) => ({
        kode: String(it.kode || "").trim(),
        nama: String(it.nama || "").trim(),
        qty: Number(it.qty) || 0,
      }))
      .filter((it) => (it.kode !== "" || it.nama !== "") && it.qty > 0);

    if (cleanItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Minimal harus ada 1 item pesanan dengan Qty lebih dari 0." },
        { status: 400 }
      );
    }

    const totalJenisItem = cleanItems.length;
    const totalQty = cleanItems.reduce((sum, it) => sum + it.qty, 0);

    // Insert ke tabel pesanan_fmi (no_order otomatis di-generate oleh sequence PostgreSQL agar tidak tabrakan)
    const { data, error } = await db
      .from("pesanan_fmi")
      .insert([
        {
          kode_toko: kodeToko,
          nama_toko: namaToko,
          items: cleanItems,
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
