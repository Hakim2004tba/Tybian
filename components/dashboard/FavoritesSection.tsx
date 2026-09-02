import Image from "next/image";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth/session";
import { getFavoritesPage } from "@/lib/data/student-dashboard";
import { Pagination } from "@/components/dashboard/Pagination";

export async function FavoritesSection({
  page,
  currentParams,
}: {
  page: number;
  currentParams: Record<string, string | undefined>;
}) {
  const user = await getSessionUser();
  const { items, totalCount, pageSize } = await getFavoritesPage(user!.id, page);

  if (items.length === 0 && page === 1) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-[14px] text-text-secondary-light">
          <Heart size={16} className="text-text-muted-light" />
          لا توجد دورات محفوظة في المفضلة بعد.
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((course) => (
          <Link key={course.id} href={`/courses/${course.slug}`}>
            <Card padded={false} interactive className="flex items-center gap-3 overflow-hidden p-3">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-sm bg-bg-light">
                {course.cover_url && (
                  <Image src={course.cover_url} alt={course.title} fill className="object-cover" unoptimized />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{course.title}</div>
                <div className="num mt-0.5 flex items-center gap-1 text-[12px] text-text-muted-light">
                  <Star size={11} className="fill-gold text-gold" />
                  {course.rating.toFixed(1)}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        paramName="favoritesPage"
        basePath="/dashboard"
        currentParams={currentParams}
      />
    </div>
  );
}
