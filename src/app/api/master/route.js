import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : supabase;

    if (!db) {
      return NextResponse.json(
        { ok: false, error: "Koneksi Supabase belum dikonfigurasi." },
        { status: 500 }
      );
    }

    const [tokoRes, itemRes] = await Promise.all([
      db
        .from("master_toko_fmi")
        .select("id, code, store, dc, type, city, address, pic, status")
        .order("store", { ascending: true }),
      db
        .from("master_item_fmi")
        .select("id, article, barcode, article_name, status")
        .order("article_name", { ascending: true }),
    ]);

    if (tokoRes.error) {
      return NextResponse.json(
        { ok: false, error: `Gagal memuat data toko: ${tokoRes.error.message}` },
        { status: 500 }
      );
    }

    if (itemRes.error) {
      return NextResponse.json(
        { ok: false, error: `Gagal memuat data item: ${itemRes.error.message}` },
        { status: 500 }
      );
    }

    const stores = (tokoRes.data || [])
      .filter((s) => {
        const st = String(s.status || "Aktif").trim().toLowerCase();
        return st !== "nonaktif" && st !== "inactive" && st !== "closed";
      })
      .map((s) => ({
        code: String(s.code || "").trim(),
        store: String(s.store || "").trim(),
        dc: String(s.dc || "").trim(),
        type: String(s.type || "").trim(),
        city: String(s.city || "").trim(),
        address: String(s.address || "").trim(),
        pic: String(s.pic || "").trim(),
      }));

    const items = (itemRes.data || [])
      .filter((it) => {
        const st = String(it.status || "Active").trim().toLowerCase();
        return st === "active" || st === "aktif";
      })
      .map((it) => {
        const rawArticle = String(it.article || "").trim();
        const rawBarcode = String(it.barcode || "").trim();
        // Jika article masih "TBC" atau kosong, gunakan barcode sebagai kode utama agar unik
        const displayKode =
          !rawArticle || rawArticle.toUpperCase() === "TBC" ? rawBarcode : rawArticle;

        return {
          kode: displayKode,
          article: rawArticle,
          barcode: rawBarcode,
          nama: String(it.article_name || "").trim(),
          status: String(it.status || "Active").trim(),
        };
      });

    return NextResponse.json({
      ok: true,
      stores,
      items,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
