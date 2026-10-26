import { useEffect, useRef, useState } from "react";
import { usePhotoUrl } from "@/lib/attendance-photo";
import { ImageOff } from "lucide-react";

type Props = {
  photoUrl: string | null | undefined;
  alt?: string;
  className?: string;
  /** Wrap the image in an <a> that opens the signed URL in a new tab. */
  asLink?: boolean;
  /** Optional placeholder when there is no photo (e.g. "foto dihapus"). */
  empty?: React.ReactNode;
  /**
   * Hanya unduh foto ketika elemen masuk ke layar (default untuk daftar/rekap).
   * Set `false` pada tampilan detail yang memang langsung menampilkan foto.
   */
  lazy?: boolean;
};

export function AttendancePhoto({
  photoUrl,
  alt = "Foto",
  className,
  asLink,
  empty,
  lazy = true,
}: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const signed = usePhotoUrl(photoUrl, visible);
  const [failed, setFailed] = useState(false);

  // Reset the error state whenever the source or signed URL changes.
  useEffect(() => {
    setFailed(false);
  }, [photoUrl, signed]);

  // Tunda permintaan storage sampai thumbnail benar-benar terlihat.
  useEffect(() => {
    if (!lazy || visible) return;
    const el = holderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, visible]);

  if (!photoUrl) return <>{empty ?? null}</>;

  // While resolving, or when the file cannot be loaded, show a clean
  // thumbnail-sized placeholder instead of a broken image icon.
  if (!signed || failed) {
    return (
      <div
        ref={holderRef}
        className={`${className ?? ""} flex items-center justify-center bg-muted`}
      >
        <ImageOff className="w-4 h-4 text-muted-foreground/60" aria-hidden />
      </div>
    );
  }

  const img = (
    <img
      src={signed}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
  if (asLink) {
    return (
      <a href={signed} target="_blank" rel="noreferrer">
        {img}
      </a>
    );
  }
  return img;
}
