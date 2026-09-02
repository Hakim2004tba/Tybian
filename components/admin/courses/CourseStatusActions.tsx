"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Archive, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  publishCourseAction,
  unpublishCourseAction,
  archiveCourseAction,
  deleteCourseAction,
  toggleFeaturedAction,
} from "@/lib/admin/actions/courses";

export function CourseStatusActions({
  courseId,
  status,
  isFeatured,
}: {
  courseId: string;
  status: "draft" | "published" | "archived";
  isFeatured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<{ error: string | null }>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const result = await action(courseId);
      if (result?.error) window.alert(result.error);
    });
  }

  function runToggleFeatured() {
    startTransition(async () => {
      const result = await toggleFeaturedAction(courseId, !isFeatured);
      if (result?.error) window.alert(result.error);
      else router.refresh();
    });
  }

  function runDelete() {
    if (!window.confirm("حذف هذه الدورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    startTransition(async () => {
      const result = await deleteCourseAction(courseId);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      router.push("/admin/courses");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && status !== "archived" && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(publishCourseAction)}
        >
          <Eye size={15} />
          نشر
        </Button>
      )}
      {status === "published" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(unpublishCourseAction)}
        >
          <EyeOff size={15} />
          إلغاء النشر
        </Button>
      )}
      {status !== "archived" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(archiveCourseAction, "هل تريد أرشفة هذه الدورة؟ لن تظهر للطلاب بعد الأرشفة.")
          }
        >
          <Archive size={15} />
          أرشفة
        </Button>
      )}
      <Button
        variant={isFeatured ? "primary" : "ghost"}
        size="sm"
        disabled={pending}
        onClick={runToggleFeatured}
        title={status !== "published" ? "لن تظهر في الصفحة الرئيسية إلا بعد النشر" : undefined}
      >
        <Star size={15} className={isFeatured ? "fill-current" : ""} />
        {isFeatured ? "مميّزة" : "إبراز"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={runDelete} className="text-error hover:text-error">
        <Trash2 size={15} />
        حذف
      </Button>
    </div>
  );
}
