"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";

/**
 * Uploads an image through /api/admin/upload, which writes it to the
 * server's own disk. Supabase Storage is gone, and with it the
 * browser-direct upload — a 5 MB cover image through the server is a
 * fair trade for not running a storage service. Bunny still takes video
 * uploads straight from the browser; that flow is untouched.
 *
 * Renders a hidden `<input type="hidden" name={name}>` holding the
 * resulting public URL, so it plugs directly into existing
 * FormData-based Server Actions (createCourseAction, etc.) with zero
 * changes to their signatures — they still just read `formData.get(name)`
 * as a plain string, exactly as when it was a manual URL text field.
 */
export function ImageUploadField({
  name,
  label,
  bucket,
  defaultValue,
}: {
  name: string;
  label: string;
  bucket: "course-covers" | "avatars";
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("الرجاء اختيار ملف صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("الحجم الأقصى للصورة 5 ميجابايت");
      return;
    }

    setError(null);
    setUploading(true);

    // The filename is not sent: the route names the file itself from a
    // uuid and picks the extension from the MIME type, so nothing
    // attacker-controlled reaches the filesystem.
    const body = new FormData();
    body.append("file", file);
    body.append("bucket", bucket);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body });

      if (!res.ok) {
        const messages: Record<string, string> = {
          too_large: "الحجم الأقصى للصورة 5 ميجابايت",
          bad_type: "صيغة الصورة غير مدعومة — استخدم JPG أو PNG أو WebP",
        };
        const { error: code } = await res.json().catch(() => ({ error: "" }));
        setError(messages[code] ?? "تعذّر رفع الصورة، حاول مجدداً");
        return;
      }

      const { url: uploadedUrl } = await res.json();
      setUrl(uploadedUrl);
    } catch {
      setError("تعذّر الاتصال بالخادم أثناء رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13.5px] font-semibold">{label}</label>
      <input type="hidden" name={name} value={url} />

      {error && <p className="text-[12px] text-error">{error}</p>}

      {url ? (
        <div className="relative h-32 w-full max-w-xs overflow-hidden rounded-md border border-border-light">
          <Image src={url} alt="" fill className="object-cover" unoptimized />
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="إزالة الصورة"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-light bg-bg-light text-text-muted-light transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
          <span className="text-[12.5px]">{uploading ? "جارٍ الرفع..." : "اضغط لاختيار صورة"}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
