import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { getArticleBySlug } from "@/lib/data/articles";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "long", year: "numeric" });

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <div className="bg-bg-light py-3xl">
      <Container width="reading">
        <h1>{article.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-[13.5px] text-text-muted-light">
          <span>{article.author?.full_name ?? "فريق تبيان"}</span>
          {article.published_at && <span className="num">· {dateFormatter.format(new Date(article.published_at))}</span>}
        </div>

        {article.cover_url && (
          <div className="relative mt-6 aspect-video overflow-hidden rounded-lg">
            <Image src={article.cover_url} alt={article.title} fill className="object-cover" unoptimized />
          </div>
        )}

        <div className="mt-8 whitespace-pre-line text-[15.5px] leading-loose text-text-secondary-light">
          {article.body}
        </div>
      </Container>
    </div>
  );
}
