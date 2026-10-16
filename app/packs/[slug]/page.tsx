import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers, BookOpen, Check, Infinity as InfinityIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { getPackBySlug, alreadyOwned } from "@/lib/data/packs";
import { getSessionUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { BuyPackButton } from "@/components/packs/BuyPackButton";

export const dynamic = "force-dynamic";

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { dict } = await getDictionary();
  const t = dict.packs;

  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  const user = await getSessionUser();
  const owned = user ? await alreadyOwned(user.id, pack.id) : [];
  const ownsAll = owned.length >= pack.courses.length;

  return (
    <div className="bg-bg-light py-2xl">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[12px] font-bold text-primary">
              <Layers size={13} />
              {t.badge}
            </span>
            <h1 className="mt-3 text-[26px] font-bold text-text-primary-light md:text-[32px]">
              {pack.title}
            </h1>
            {pack.description && (
              <p className="mt-2.5 max-w-2xl text-[14.5px] leading-relaxed text-text-secondary-light">
                {pack.description}
              </p>
            )}

            <h2 className="mb-3 mt-8 text-[17px] font-semibold text-text-primary-light">
              {t.whatsInside}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {pack.courses.map((c) => {
                const has = owned.includes(c.id);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/courses/${c.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-border-light bg-white p-3 transition-colors hover:border-primary/40"
                    >
                      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-academy-lavender">
                        {c.cover_url ? (
                          <Image src={c.cover_url} alt="" fill sizes="56px" className="object-cover" />
                        ) : (
                          <BookOpen size={18} className="text-primary/50" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-text-primary-light">
                          {c.title}
                        </span>
                        <span className="num mt-0.5 block text-[12px] text-text-muted-light">
                          {c.lessons_count} {t.lessons}
                          {c.own_price !== null && ` · ${c.own_price.toLocaleString("en-US")} ${pack.currency}`}
                        </span>
                      </span>
                      {/*
                        Saying plainly which courses the student already
                        owns. Hiding it would sell them something they
                        have, and they would find out after paying.
                      */}
                      {has && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11.5px] font-semibold text-success">
                          <Check size={12} />
                          {t.alreadyOwned}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-primary/25 bg-white p-5">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="num text-[30px] font-bold text-text-primary-light">
                  {pack.price.toLocaleString("en-US")}
                </span>
                <span className="text-[13px] text-text-muted-light">{pack.currency}</span>
              </div>

              {pack.saving > 0 && (
                <>
                  <p className="num mt-1 text-[13px] text-text-muted-light line-through">
                    {t.separately} {pack.separateTotal.toLocaleString("en-US")} {pack.currency}
                  </p>
                  <p className="num mt-2 w-fit rounded-full bg-success/10 px-3 py-1 text-[13px] font-bold text-success">
                    {t.save} {pack.saving.toLocaleString("en-US")} {pack.currency}
                  </p>
                </>
              )}

              <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-text-secondary-light">
                <InfinityIcon size={14} className="mt-0.5 shrink-0 text-primary" />
                {t.lifetimeNote}
              </p>

              <div className="mt-4">
                {ownsAll ? (
                  <p className="rounded-full bg-success/10 px-4 py-2.5 text-center text-[13px] font-semibold text-success">
                    {t.ownAll}
                  </p>
                ) : (
                  <BuyPackButton packId={pack.id} plans={pack.plans} currency={pack.currency} />
                )}
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
