import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { queryOne } from "@/lib/db";
import { columnExists } from "@/lib/db/tables";
import { parseVimeoSource } from "@/lib/video/extract-vimeo-event";

export default async function AdminSettingsPage() {
  // Guarded by app/admin/layout.tsx's requireRouteAccess("/admin").
  /* intro_video arrives in migration 21; asked for only when it is
     there, so the page still loads before it is run. */
  const hasIntro = await columnExists("platform_settings", "intro_video");
  const settings = await queryOne<{
    site_name: string;
    support_email: string | null;
    maintenance_mode: number;
    intro_video?: string | null;
  }>(
    `SELECT site_name, support_email, maintenance_mode${hasIntro ? ", intro_video" : ""}
       FROM platform_settings WHERE id = 1`
  );

  // TINYINT(1) comes back as 0/1; the form expects a boolean.
  const settingsForForm = settings
    ? {
        ...settings,
        maintenance_mode: settings.maintenance_mode === 1,
        /* Stored as "video:<id>[:<hash>]"; the field shows a link the
           admin can recognise and paste back. */
        intro_video: (() => {
          const parsed = parseVimeoSource(settings.intro_video ?? null);
          if (!parsed) return "";
          return parsed.kind === "event"
            ? `https://vimeo.com/event/${parsed.id}${parsed.hash ? `/${parsed.hash}` : ""}`
            : `https://vimeo.com/${parsed.id}${parsed.hash ? `/${parsed.hash}` : ""}`;
        })(),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">الإعدادات</Badge>
        <h1 className="mt-3 text-2xl">إعدادات المنصة</h1>
      </div>

      <Card className="max-w-lg">
        <SettingsForm
          settings={
            settingsForForm ?? { site_name: "تبيان | TIBYAN", support_email: null, maintenance_mode: false }
          }
        />
      </Card>
    </div>
  );
}
