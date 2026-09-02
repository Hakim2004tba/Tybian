import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ArticleForm } from "@/components/admin/articles/ArticleForm";
import { ArticleStatusActions } from "@/components/admin/articles/ArticleStatusActions";
import { updateArticleAction } from "@/lib/admin/actions/articles";
import { getArticleForEdit } from "@/lib/data/admin-articles";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticleForEdit(id);
  if (!article) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet">تعديل المقال</Badge>
          <h1 className="mt-3 text-2xl">{article.title}</h1>
        </div>
        <ArticleStatusActions articleId={id} isPublished={article.is_published} redirectOnDeleteTo="/admin/articles" />
      </div>

      <Card className="max-w-3xl">
        <ArticleForm
          action={updateArticleAction.bind(null, id)}
          submitLabel="حفظ التعديلات"
          initial={{
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt ?? "",
            body: article.body,
            coverUrl: article.cover_url ?? "",
          }}
        />
      </Card>
    </div>
  );
}
