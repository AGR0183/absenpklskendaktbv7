import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logoSmkn2 from "@/assets/logo-smkn2.png";
import shotLogin from "@/assets/panduan-login.png";
import shotBeranda from "@/assets/panduan-beranda.png";
import shotRiwayat from "@/assets/panduan-riwayat.png";
import shotGuru from "@/assets/panduan-rekap-guru.png";
import shotOrtu from "@/assets/panduan-ortu.png";
import shotSertifikat from "@/assets/panduan-sertifikat.png";

export const Route = createFileRoute("/panduan")({
  component: PanduanPage,
  head: () => ({
    meta: [
      { title: "Buku Panduan SIAP PKL — SMKN 2 Kotabaru" },
      {
        name: "description",
        content:
          "Panduan lengkap penggunaan aplikasi SIAP PKL SMK Negeri 2 Kotabaru untuk siswa, guru pembimbing, pembimbing DUDI, orang tua, dan admin.",
      },
      { property: "og:title", content: "Buku Panduan SIAP PKL" },
      {
        property: "og:description",
        content:
          "Panduan lengkap absensi PKL: login PIN, absen masuk & pulang, rekap, sertifikat, notifikasi WhatsApp, dan administrasi.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Section = { id: string; title: string; body: React.ReactNode };

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground marker:text-primary">
      {children}
    </ul>
  );
}
function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal pl-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground marker:text-primary marker:font-semibold">
      {children}
    </ol>
  );
}
function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
      {children}
    </div>
  );
}

function Figure({
  src,
  alt,
  caption,
  narrow,
}: {
  src: string;
  alt: string;
  caption: string;
  narrow?: boolean;
}) {
  return (
    <figure className="space-y-1.5">
      <div className="rounded-xl border border-border bg-muted/40 p-2 overflow-hidden">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`w-full ${narrow ? "max-w-[260px]" : "max-w-[380px]"} mx-auto rounded-lg border border-border shadow-sm bg-card`}
        />
      </div>
      <figcaption className="text-[11px] text-center text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

const SECTIONS: Section[] = [
  {
    id: "pengenalan",
    title: "1. Pengenalan Aplikasi",
    body: (
      <div className="space-y-3">
        <P>
          <B>SIAP PKL</B> adalah <B>S</B>istem <B>I</B>nformasi <B>A</B>bsensi dan{" "}
          <B>P</B>emantauan <B>P</B>raktik <B>K</B>erja <B>L</B>apangan milik SMK Negeri 2 Kotabaru.
          Aplikasi mencatat kehadiran siswa PKL secara digital lengkap dengan foto selfie, titik
          lokasi GPS, dan jam otomatis zona WITA.
        </P>
        <P>Manfaat utama:</P>
        <UL>
          <li>Absensi masuk & pulang cepat langsung dari HP.</li>
          <li>Bukti kehadiran berupa foto + lokasi sehingga tidak bisa dititipkan.</li>
          <li>Rekap otomatis untuk guru pembimbing, pembimbing DUDI, dan orang tua.</li>
          <li>Pengingat WhatsApp otomatis bila siswa belum absen.</li>
          <li>Sertifikat penghargaan kehadiran bagi siswa berprestasi.</li>
        </UL>
        <Figure
          src={logoSmkn2}
          alt="Logo SMK Negeri 2 Kotabaru"
          caption="Logo SMK Negeri 2 Kotabaru pada aplikasi SIAP PKL"
          narrow
        />
        <Note>
          Aplikasi dapat dipasang di layar utama HP (PWA). Buka aplikasi di browser, pilih menu
          browser lalu <B>Tambahkan ke Layar Utama</B>.
        </Note>
      </div>
    ),
  },
  {
    id: "peran",
    title: "2. Peran Pengguna",
    body: (
      <div className="space-y-3">
        <UL>
          <li>
            <B>Siswa</B> — melakukan absen masuk/pulang, melihat riwayat, mengunduh sertifikat.
          </li>
          <li>
            <B>Guru Pembimbing</B> — memantau rekap absensi siswa bimbingannya.
          </li>
          <li>
            <B>Pembimbing DUDI</B> — memantau rekap siswa yang PKL di tempat usahanya.
          </li>
          <li>
            <B>Orang Tua</B> — memantau kehadiran anak dan mengubah PIN anak.
          </li>
          <li>
            <B>Admin</B> — mengelola seluruh data siswa, akun, pengaturan jam kerja, hari libur,
            notifikasi WhatsApp, sertifikat, dan cadangan data.
          </li>
        </UL>
      </div>
    ),
  },
  {
    id: "login",
    title: "3. Cara Masuk (Login)",
    body: (
      <div className="space-y-3">
        <P>
          Di halaman login pilih peran Anda terlebih dahulu, lalu masukkan identitas sesuai peran.
        </P>
        <OL>
          <li>
            <B>Siswa / Orang Tua / DUDI</B>: pilih nama (atau masukkan nomor identitas), lalu
            masukkan <B>PIN 4 digit</B>.
          </li>
          <li>
            <B>Guru / Admin</B>: masuk dengan <B>username</B> dan <B>kata sandi</B>.
          </li>
          <li>Setelah berhasil, aplikasi langsung membuka dasbor sesuai peran.</li>
        </OL>
        <Figure
          src={shotLogin}
          alt="Tampilan halaman login SIAP PKL dengan pilihan peran"
          caption="Halaman login: pilih peran sebelum memasukkan PIN atau kata sandi"
        />
        <Note>
          Keamanan PIN: setelah <B>10 kali</B> salah PIN, akun terkunci sementara selama{" "}
          <B>30 menit</B>. Hubungi admin atau tunggu masa kunci berakhir.
        </Note>
      </div>
    ),
  },
  {
    id: "siswa",
    title: "4. Panduan Siswa",
    body: (
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">4.1 Melengkapi Profil</h4>
          <P>
            Saat pertama kali masuk, siswa wajib melengkapi <B>nama</B>, <B>kelas</B>, dan{" "}
            <B>tempat PKL</B>. Siswa hanya boleh mengubah nomor HP miliknya sendiri dan PIN; nomor
            HP orang tua, guru, dan DUDI hanya dapat diubah oleh admin.
          </P>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">4.2 Absen Masuk</h4>
          <OL>
            <li>Buka menu <B>Beranda</B> lalu tekan tombol <B>Absen Masuk</B>.</li>
            <li>Izinkan akses <B>kamera</B> dan <B>lokasi</B> saat diminta browser.</li>
            <li>Ambil foto selfie di lokasi PKL, tunggu titik GPS terbaca.</li>
            <li>Tekan <B>Kirim</B>. Jam tersimpan otomatis dalam zona WITA.</li>
          </OL>
          <Figure
            src={shotBeranda}
            alt="Tampilan beranda siswa dengan tombol Absen Masuk dan Absen Pulang"
            caption="Beranda siswa: tombol Absen Masuk aktif, Absen Pulang masih terkunci"
          />
          <Note>
            Jika GPS bermasalah, aplikasi tetap mengizinkan absen menggunakan kamera bawaan agar
            siswa tidak kehilangan kehadiran. Lokasi akan dicatat seadanya.
          </Note>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">4.3 Absen Pulang</h4>
          <P>
            Tombol <B>Absen Pulang</B> baru terbuka setelah absen masuk dilakukan dan setelah jam
            pulang tercapai:
          </P>
          <UL>
            <li>Senin – Kamis & Sabtu: mulai <B>15.00 WITA</B></li>
            <li>Jumat: mulai <B>10.30 WITA</B></li>
            <li>Akhir pekan/khusus: mulai <B>12.00 WITA</B></li>
          </UL>
          <P>Jam ini dapat disesuaikan admin melalui Pengaturan Jam Kerja.</P>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">4.4 Riwayat & Rekap</h4>
          <P>
            Menu <B>Riwayat</B> menampilkan daftar absensi harian beserta foto dan lokasi. Kartu
            statistik <B>Masuk, Pulang, Izin, Sakit, Alpa</B> dapat diklik untuk melihat rincian
            tanggalnya.
          </P>
          <Figure
            src={shotRiwayat}
            alt="Tampilan riwayat absensi siswa beserta kartu statistik kehadiran"
            caption="Riwayat absensi dengan kartu statistik Masuk, Pulang, Izin, Sakit, dan Alpa"
          />
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">4.5 Sertifikat</h4>
          <P>
            Menu <B>Sertifikat</B> menampilkan pratinjau sertifikat penghargaan kehadiran
            (bertanda air <B>DRAFT</B>). Sertifikat dapat diunduh bila persentase kehadiran{" "}
            <B>≥ 95%</B> dan setelah tanggal rilis <B>5 Februari 2027</B>.
          </P>
          <Figure
            src={shotSertifikat}
            alt="Pratinjau sertifikat penghargaan kehadiran dengan tanda air DRAFT"
            caption="Pratinjau sertifikat bertanda air DRAFT sebelum tanggal rilis"
          />
        </div>
      </div>
    ),
  },
  {
    id: "perhitungan",
    title: "5. Aturan Perhitungan Kehadiran",
    body: (
      <div className="space-y-3">
        <UL>
          <li>
            Absen <B>masuk + pulang</B> = <B>1 hari</B> hadir.
          </li>
          <li>
            Absen <B>masuk saja</B> = <B>0,5 hari</B> hadir dan <B>0,5 ALPA</B>.
          </li>
          <li>
            <B>Tidak absen sama sekali</B> pada hari kerja = <B>1 ALPA</B>.
          </li>
          <li>Hari libur nasional dan hari non-aktif tidak dihitung sebagai ALPA.</li>
          <li>
            Perhitungan dimulai dari tanggal awal periode PKL atau hari pertama siswa absen (mana
            yang lebih akhir), sehingga siswa yang mulai belakangan tidak dirugikan.
          </li>
          <li>Izin dan Sakit dicatat terpisah dan tidak dihitung ALPA.</li>
        </UL>
        <P>
          Persentase kehadiran = total hari hadir ÷ total hari kerja efektif × 100%.
        </P>
      </div>
    ),
  },
  {
    id: "guru",
    title: "6. Panduan Guru Pembimbing",
    body: (
      <div className="space-y-3">
        <OL>
          <li>Masuk dengan username & kata sandi guru.</li>
          <li>
            Dasbor <B>Rekap Absen</B> menampilkan seluruh siswa bimbingan beserta status hari ini.
          </li>
          <li>
            Gunakan <B>filter</B> berdasarkan nama, tanggal, kelas, dan tempat PKL untuk mempersempit
            data.
          </li>
          <li>Tandai siswa sebagai favorit agar selalu tampil di urutan atas.</li>
          <li>
            Klik nama siswa untuk membuka <B>Kartu Profil Siswa</B>: statistik kehadiran, rincian
            per kategori, foto absen, lokasi, serta tombol kirim <B>WhatsApp</B> langsung ke siswa,
            orang tua, atau DUDI.
          </li>
          <li>
            Tombol <B>Ekspor Excel</B> menghasilkan rekap matriks kehadiran per bulan.
          </li>
        </OL>
        <Figure
          src={shotGuru}
          alt="Tampilan rekap absen guru pembimbing dengan filter dan daftar siswa"
          caption="Rekap absen guru: filter nama, tanggal, kelas, tempat PKL, dan ekspor Excel"
        />
      </div>
    ),
  },
  {
    id: "dudi",
    title: "7. Panduan Pembimbing DUDI",
    body: (
      <div className="space-y-3">
        <P>
          Pembimbing DUDI masuk menggunakan nomor identitas dan PIN, lalu diarahkan ke dasbor{" "}
          <B>Rekap Absen</B> yang hanya memuat siswa di tempat usahanya.
        </P>
        <UL>
          <li>Melihat kehadiran harian dan bulanan tiap siswa.</li>
          <li>Membuka foto dan lokasi absen sebagai bukti kehadiran.</li>
          <li>Menerima pengingat WhatsApp bila siswa belum absen.</li>
        </UL>
      </div>
    ),
  },
  {
    id: "ortu",
    title: "8. Panduan Orang Tua",
    body: (
      <div className="space-y-3">
        <OL>
          <li>Masuk memakai data anak/nomor HP yang terdaftar dan PIN orang tua.</li>
          <li>
            Dasbor <B>Anak Saya</B> menampilkan kartu tiap anak lengkap dengan statistik Masuk,
            Pulang, Izin, Sakit, dan Alpa.
          </li>
          <li>Klik kartu anak untuk melihat rekap harian/bulanan, foto, dan lokasi absen.</li>
          <li>
            Tombol <B>Ubah PIN</B> di bagian atas halaman digunakan untuk mengganti PIN anak; bila
            memiliki lebih dari satu anak, pilih dulu anak yang dimaksud.
          </li>
        </OL>
        <Figure
          src={shotOrtu}
          alt="Tampilan dasbor orang tua dengan kartu tiap anak dan statistik kehadiran"
          caption="Dasbor orang tua: kartu tiap anak dan tombol Ubah PIN di bagian atas"
        />
      </div>
    ),
  },
  {
    id: "admin",
    title: "9. Panduan Admin",
    body: (
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">9.1 Data Siswa & Akun</h4>
          <UL>
            <li>
              Menambah/mengubah profil siswa: PIN, nama lengkap, NISN, kelas, tempat PKL, serta
              nomor HP siswa, orang tua, guru, dan DUDI.
            </li>
            <li>
              <B>Impor CSV</B> untuk membuat banyak akun sekaligus. Kolom <B>role</B> menentukan
              peran (siswa/guru/admin) dan data duplikat otomatis dilewati.
            </li>
            <li>Melihat daftar PIN siswa untuk keperluan pendampingan.</li>
          </UL>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">9.2 Pengaturan Jam & Libur</h4>
          <UL>
            <li>Mengatur jam pulang tiap hari dan hari aktif PKL.</li>
            <li>Menambah tanggal libur nasional agar tidak dihitung ALPA.</li>
          </UL>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">9.3 Notifikasi WhatsApp</h4>
          <P>
            Pada kartu <B>Pengaturan Notifikasi WA</B> admin mengatur token Fonnte, jam kirim tiap
            tahap (WITA), jeda antar pesan, hari aktif, dan isi template pesan. Tahap yang tersedia:
          </P>
          <UL>
            <li>Pengingat <B>siswa</B> belum absen masuk.</li>
            <li>Pengingat <B>siswa</B> belum absen pulang.</li>
            <li>Pengingat ke <B>orang tua</B>.</li>
            <li>Pengingat ke <B>pembimbing DUDI</B>.</li>
            <li>Ringkasan harian ke <B>guru pembimbing</B>.</li>
            <li>Ringkasan <B>rekap ALPA</B> otomatis pukul 09.00 WITA.</li>
          </UL>
          <P>
            Variabel template yang bisa dipakai: <B>{"{nama}"}</B>, <B>{"{kelas}"}</B>,{" "}
            <B>{"{tempat}"}</B>, dan <B>{"{tanggal}"}</B>.
          </P>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-foreground">9.4 Sertifikat & Cadangan</h4>
          <UL>
            <li>
              Menu <B>Sertifikat</B> admin: cari siswa, lihat persentase, unduh satuan atau{" "}
              <B>Unduh Semua</B> dalam bentuk ZIP.
            </li>
            <li>Membuat cadangan data dan menghapus foto absen lama untuk menghemat ruang.</li>
          </UL>
        </div>
      </div>
    ),
  },
  {
    id: "masalah",
    title: "10. Masalah Umum & Solusi",
    body: (
      <div className="space-y-3">
        <UL>
          <li>
            <B>Kamera tidak muncul</B> — izinkan akses kamera pada pengaturan situs di browser, lalu
            muat ulang halaman.
          </li>
          <li>
            <B>Lokasi gagal terbaca</B> — aktifkan GPS, keluar dari ruangan tertutup; absen tetap
            dapat dilanjutkan dengan kamera.
          </li>
          <li>
            <B>Tombol Absen Pulang terkunci</B> — pastikan sudah absen masuk dan jam pulang sudah
            tercapai.
          </li>
          <li>
            <B>Lupa PIN</B> — minta orang tua (untuk siswa) atau admin untuk mengatur ulang PIN.
          </li>
          <li>
            <B>Akun terkunci</B> — tunggu 30 menit setelah 10 kali salah PIN.
          </li>
          <li>
            <B>Sertifikat tidak bisa diunduh</B> — kehadiran belum mencapai 95% atau belum
            memasuki tanggal rilis.
          </li>
          <li>
            <B>Notifikasi WA tidak terkirim</B> — periksa token Fonnte, nomor HP tujuan, status
            tahap aktif, dan hari aktif pada pengaturan admin.
          </li>
        </UL>
      </div>
    ),
  },
  {
    id: "kontak",
    title: "11. Bantuan & Kontak",
    body: (
      <div className="space-y-2">
        <P>
          Untuk kendala teknis, hubungi admin aplikasi SMK Negeri 2 Kotabaru.
        </P>
        <P>
          Pengembang: <B>Agus Rusbandi</B> —{" "}
          <a className="text-primary underline" href="mailto:arusbandi@gmail.com">
            arusbandi@gmail.com
          </a>
        </P>
      </div>
    ),
  },
];

function PanduanPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <header className="space-y-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                Buku Panduan Lengkap
              </h1>
              <p className="text-sm text-primary font-semibold">
                SIAP PKL — SMK Negeri 2 Kotabaru
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Sistem Informasi Absensi dan Pemantauan
                <br />
                Praktik Kerja Lapangan
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="print:hidden shrink-0"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Cetak / PDF
            </Button>
          </div>
        </header>

        <nav className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold mb-2 text-foreground">Daftar Isi</h2>
          <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted-foreground hover:text-primary">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Accordion
          type="multiple"
          defaultValue={SECTIONS.map((s) => s.id)}
          className="space-y-3"
        >
          {SECTIONS.map((s) => (
            <AccordionItem
              key={s.id}
              value={s.id}
              id={s.id}
              className="rounded-xl border border-border bg-card px-4 scroll-mt-4"
            >
              <AccordionTrigger className="text-left text-sm font-bold text-foreground">
                {s.title}
              </AccordionTrigger>
              <AccordionContent className="pb-4">{s.body}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <footer className="text-center text-[11px] text-muted-foreground pb-8">
          Versi panduan Agustus 2026 · Dibuat oleh Agus Rusbandi
        </footer>
      </div>
    </div>
  );
}
