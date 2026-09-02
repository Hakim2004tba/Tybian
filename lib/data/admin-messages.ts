import "server-only";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 15;

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  status: string;
  created_at: string;
};

export async function listContactMessages(page: number) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("contact_messages")
    .select("id, name, email, subject, body, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  return { items: (data ?? []) as ContactMessageRow[], totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}
