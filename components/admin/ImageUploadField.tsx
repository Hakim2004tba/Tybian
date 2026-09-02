"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads directly from the browser to Supabase Storage — same
 * "don't proxy large files through our own server" principle as the
 * Bunny video upload widget. The admin's own session already satisfies
 * the bucket's RLS write policy (`*_admin_write`, 0028), so no signed
 * URL or server round-trip is needed first.
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

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

    if (uploadError) {
      setError("تعذّر رفع الصورة: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setUrl(data.publicUrl);
    setUploading(false);
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
