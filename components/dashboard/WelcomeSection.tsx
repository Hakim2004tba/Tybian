import { getDictionary } from "@/lib/i18n/locale";
export async function WelcomeSection({ name }: { name: string }) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  return (
    <div>
      <h1 className="text-2xl">{t.welcome.greeting} {name} 👋</h1>
      <p className="mt-1 text-text-secondary-light">{t.welcome.subtitle}</p>
    </div>
  );
}
