import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ArticleForm } from "@/components/admin/articles/ArticleForm";
import { createArticleAction } from "@/lib/admin/actions/articles";

export default function NewArticlePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">مقال جديد</Badge>
        <h1 className="mt-3 text-2xl">إنشاء مقال</h1>
      </div>
      <Card className="max-w-3xl">
        <ArticleForm action={createArticleAction} submitLabel="إنشاء المقال" />
      </Card>
    </div>
  );
}
