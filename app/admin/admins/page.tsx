import { ShieldCheck, Crown } from "lucide-react";
import { requireRouteAccess } from "@/lib/auth/session";
import { listAdmins, viewerIsOwner } from "@/lib/admin/actions/admins";
import { DemoteAdminButton } from "@/components/admin/admins/DemoteAdminButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Who can administer the platform.
 *
 * There was no such list: admins were created from the students table
 * and then became invisible — the only way to know who held the keys
 * was to read the database. For an account that can see every payment
 * and delete any course, that is the wrong amount of visibility.
 */
export default async function AdminAdminsPage() {
  await requireRouteAccess("/admin");

  const [admins, isOwner] = await Promise.all([listAdmins(), viewerIsOwner()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">إدارة الصلاحيات</Badge>
        <h1 className="mt-3 text-2xl">المديرون</h1>
        <p className="mt-1 text-text-secondary-light">
          <span className="num">{admins.length}</span> حساب بصلاحية إدارة كاملة
        </p>
      </div>

      {!isOwner && (
        <p className="rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          صاحب المنصّة وحده يستطيع إضافة المديرين أو إزالتهم. هذه القائمة للاطّلاع.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {admins.map((admin) => (
          <Card key={admin.id} className="flex flex-wrap items-center gap-3">
            <span
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                (admin.isOwner ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary")
              }
            >
              {admin.isOwner ? <Crown size={18} /> : <ShieldCheck size={18} />}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-semibold text-text-primary-light">
                  {admin.fullName}
                </span>
                {admin.isOwner && <Badge variant="gold">صاحب المنصّة</Badge>}
              </span>
              <span className="num mt-0.5 block truncate text-[12.5px] text-text-muted-light">
                {admin.email ?? "—"} · منذ {dateFormatter.format(new Date(admin.createdAt))}
                {admin.lastSeenAt
                  ? ` · جلسة نشطة منذ ${dateFormatter.format(new Date(admin.lastSeenAt))}`
                  : " · لا جلسة نشطة"}
              </span>
            </span>

            {/*
              The owner has no remove button at all, rather than a
              disabled one: offering an action that can never succeed is
              a worse explanation than not offering it. The reason is
              stated once, below.
            */}
            {isOwner && !admin.isOwner && (
              <DemoteAdminButton userId={admin.id} name={admin.fullName} />
            )}
          </Card>
        ))}
      </div>

      <p className="text-[12.5px] leading-relaxed text-text-muted-light">
        لإضافة مدير: افتح صفحة الطلاب، مرّر على الصف، ثم «ترقية لمشرف».
        صاحب المنصّة لا يمكن إزالته من هنا — نقل الملكية عملية قاعدة بيانات
        مقصودة، موثّقة في <span className="num">13-owner.sql</span>.
      </p>
    </div>
  );
}
