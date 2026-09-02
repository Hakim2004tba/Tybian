import { Badge } from "@/components/ui/Badge";
import { AcademicYearRow } from "@/components/admin/AcademicYearRow";
import { listAcademicYearsAdmin, getCourseCountsByYear } from "@/lib/data/admin-listings";

export default async function AdminAcademicYearsPage() {
  const [years, counts] = await Promise.all([listAcademicYearsAdmin(), getCourseCountsByYear()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">السنوات الدراسية</Badge>
        <h1 className="mt-3 text-2xl">السنوات الدراسية</h1>
        <p className="mt-1 text-text-secondary-light">السنوات السبع ثابتة بالنظام — يمكن تعديل الأسماء المعروضة فقط.</p>
      </div>

      <div className="flex flex-col gap-3">
        {years.map((y) => (
          <AcademicYearRow key={y.id} year={y} courseCount={counts.get(y.id) ?? 0} />
        ))}
      </div>
    </div>
  );
}
