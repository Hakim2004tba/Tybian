import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("site_name, support_email, maintenance_mode")
    .eq("id", 1)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">الإعدادات</Badge>
        <h1 className="mt-3 text-2xl">إعدادات المنصة</h1>
      </div>

      <Card className="max-w-lg">
        <SettingsForm
          settings={
            settings ?? { site_name: "تبيان | TIBYAN", support_email: null, maintenance_mode: false }
          }
        />
      </Card>
    </div>
  );
}
