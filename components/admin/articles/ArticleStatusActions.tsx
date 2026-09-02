"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { togglePublishArticleAction, deleteArticleAction } from "@/lib/admin/actions/articles";

export function ArticleStatusActions({
  articleId,
  isPublished,
  redirectOnDeleteTo,
}: {
  articleId: string;
  isPublished: boolean;
  redirectOnDeleteTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function togglePublish() {
    startTransition(async () => {
      const result = await togglePublishArticleAction(articleId, !isPublished);
      if (result?.error) window.alert(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm("حذف هذا المقال؟")) return;
    startTransition(async () => {
      const result = await deleteArticleAction(articleId);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      if (redirectOnDeleteTo) router.push(redirectOnDeleteTo);
      else router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={togglePublish}>
        {isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
        {isPublished ? "إلغاء النشر" : "نشر"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={handleDelete} className="text-error hover:text-error">
        <Trash2 size={14} />
        حذف
      </Button>
    </div>
  );
}
