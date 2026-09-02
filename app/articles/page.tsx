import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/dashboard/Pagination";
import { getPublishedArticles } from "@/lib/data/articles";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "long", year: "numeric" });

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const page = Math.max(1, Number(raw.page) || 1);
  const { items, totalCount, pageSize } = await getPublishedArticles(page);

  return (
    <div className="bg-bg-light py-3xl">
      <Container>
        <Badge variant="violet">المقالات</Badge>
        <h1 className="mt-4">مقالات ونصائح لطلبة الطب</h1>

        {items.length === 0 ? (
          <Card className="mt-8">
            <p className="text-[14px] text-text-secondary-light">لا توجد مقالات منشورة بعد — تابعونا قريباً.</p>
          </Card>
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <Link key={a.id} href={`/articles/${a.slug}`}>
                  <Card padded={false} interactive className="flex h-full flex-col overflow-hidden">
                    <div className="relative aspect-video bg-gradient-to-br from-[#160f2c] to-[#241a42]">
                      {a.cover_url && <Image src={a.cover_url} alt={a.title} fill className="object-cover" unoptimized />}
                    </div>
                    <div className="flex flex-1 flex-col p-lg">
                      <h3 className="text-[16px] leading-snug">{a.title}</h3>
                      {a.excerpt && <p className="mt-2 line-clamp-2 text-[13.5px] text-text-secondary-light">{a.excerpt}</p>}
                      <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-text-muted-light">
                        <span>{a.author?.full_name ?? "فريق تبيان"}</span>
                        {a.published_at && <span className="num">{dateFormatter.format(new Date(a.published_at))}</span>}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/articles" currentParams={raw} />
          </>
        )}
      </Container>
    </div>
  );
}
