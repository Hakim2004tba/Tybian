"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { setAvatarUrlAction } from "@/lib/actions/profile-avatar";
import { useI18n } from "@/lib/i18n/I18nProvider";

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * The student's own profile picture.
 *
 * Uploaded through /api/upload/avatar, which writes it to the server's
 * own disk. The bytes do pass through Next now, where they used to go
 * browser-to-storage — accepted deliberately: the cap here is 3 MB,
 * which is nothing against the process memory limit that made the
 * direct upload worth having for large files.
 *
 * The destination path is NOT sent by this component. Migration 0039's
 * storage policy enforced that the first folder matched the caller's id;
 * with no policy, the route derives the whole filename from the session
 * instead, so there is nothing here for a modified client to influence.
 *
 * No cache-busting query is needed any more: each upload gets a fresh
 * filename, so the URL changes on its own.
 */
export function AvatarUpload({
  currentUrl,
  userId,
  fullName,
}: {
  currentUrl: string | null;
  userId: string;
  fullName: string;
}) {
  const { t: T } = useI18n();
  const t = T.student;
  const [url, setUrl] = useState(currentUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onPick(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError(t.photoFormats);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t.photoTooLarge);
      return;
    }

    setBusy(true);

    const body = new FormData();
    body.append("file", file);

    let uploadedUrl: string;
    try {
      const res = await fetch("/api/upload/avatar", { method: "POST", body });

      if (!res.ok) {
        const messages: Record<string, string> = {
          too_large: t.photoTooLarge,
          bad_type: t.photoFormats,
          unauthorized: t.sessionExpired,
        };
        const { error: code } = await res.json().catch(() => ({ error: "" }));
        setBusy(false);
        setError(messages[code] ?? t.photoFailed);
        return;
      }

      ({ url: uploadedUrl } = await res.json());
    } catch {
      setBusy(false);
      setError(t.photoNetwork);
      return;
    }

    const result = await setAvatarUrlAction(uploadedUrl);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setUrl(uploadedUrl);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await setAvatarUrlAction(null);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUrl(null);
    router.refresh();
  }

  const initial = fullName.trim().charAt(0) || t.initial;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-academy-deep text-[26px] font-bold text-white ring-2 ring-academy-lavender-deep">
          {url ? (
            <Image src={url} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
          ) : (
            initial
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={t.changePhoto}
          className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        </button>
      </div>

      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-text-primary-light">{t.avatarTitle}</p>
        <p className="mt-0.5 text-[12px] text-text-muted-light">{t.photoHint}</p>
        {url && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-error hover:underline disabled:opacity-50"
          >
            <Trash2 size={12} />
            {t.removePhoto}
          </button>
        )}
        {error && <p className="mt-1.5 text-[12px] text-error">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
