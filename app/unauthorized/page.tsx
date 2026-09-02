import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center gap-4 bg-bg-light px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error/10">
        <ShieldAlert size={26} className="text-error" />
      </div>
      <h1 className="text-2xl">لا تملك صلاحية الوصول إلى هذه الصفحة</h1>
      <p className="max-w-sm text-text-secondary-light">
        حسابك الحالي لا يملك الصلاحيات اللازمة لعرض هذا المحتوى. إذا كنت
        تعتقد أن هذا خطأ، تواصل مع إدارة المنصة.
      </p>
      <Link href="/">
        <Button variant="outline" className="mt-2">
          العودة إلى الرئيسية
        </Button>
      </Link>
    </div>
  );
}
