# Pemindahan data ke proyek Supabase baru

Berkas di folder ini dipakai sekali saja, saat memindahkan seluruh data dari
proyek Supabase lama (`wkavkktmtfcshwklvvfp`) ke proyek Supabase baru.

Urutan:

1. Hubungkan proyek Supabase baru ke aplikasi (Settings → Supabase).
2. Jalankan seluruh migrasi struktur database ke proyek baru (skema tabel,
   aturan akses, fungsi, trigger) + fungsi bantu impor.
3. Buka SQL Editor proyek **lama**, tempel isi `push-data.sql`, ganti
   `__TOKEN__` dan `__URL__`, lalu jalankan. Data akan dikirim bertahap ke
   aplikasi dan masuk ke database baru.
4. Cek jumlah baris di proyek baru, lalu hapus endpoint
   `src/routes/api/public/hooks/migrate-in.ts`, fungsi `import_auth_user`,
   `finalize_role_import`, dan secret `MIGRATE_TOKEN`.

Catatan: foto absensi yang tersimpan di penyimpanan berkas tidak ikut lewat
jalur ini; unduh dulu lewat menu Admin → Cadangkan & Bersihkan Data jika
masih dibutuhkan.
