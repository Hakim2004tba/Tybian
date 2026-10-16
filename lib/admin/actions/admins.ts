"use server";

import { revalidatePath } from "next/cache";
import { execute, query, queryOne } from "@/lib/db";
import { getSessionUser, requireRouteAccess } from "@/lib/auth/session";

/**
 * Adding and removing platform administrators.
 *
 * Only the OWNER may remove one. An admin can already reach every
 * record and every setting; letting any of them demote the others turns
 * a disagreement into a race, and one mistake into a platform with no
 * administrator at all.
 *
 * The owner is a flag on an admin profile rather than a fourth role —
 * see tibyan-db/mysql/13-owner.sql for why.
 */

export type ActionState = { error: string | null; success?: string | null };

/** The signed-in user, only if they are the owner. */
async function requireOwner(): Promise<string | null> {
  await requireRouteAccess("/admin");
  const user = await getSessionUser();
  if (!user) return null;

  const row = await queryOne<{ is_owner: number }>(
    `SELECT is_owner FROM profiles WHERE id = ? AND deleted_at IS NULL`,
    [user.id]
  );
  return row?.is_owner === 1 ? user.id : null;
}

export async function demoteAdminAction(userId: string): Promise<ActionState> {
  const ownerId = await requireOwner();
  if (!ownerId) return { error: "هذا الإجراء لصاحب المنصّة وحده." };

  const target = await queryOne<{ is_owner: number; role: string; full_name: string }>(
    `SELECT is_owner, role, full_name FROM profiles WHERE id = ? AND deleted_at IS NULL`,
    [userId]
  );
  if (!target) return { error: "الحساب غير موجود." };
  if (target.role !== "admin") return { error: "هذا الحساب ليس مديراً." };

  /*
    The owner cannot be demoted — not by anyone, including themselves.
    Without this, one click empties the platform of its only account
    that can ever appoint another admin, and nothing in the product can
    undo it. Transferring ownership is a deliberate database operation,
    documented at the bottom of 13-owner.sql.
  */
  if (target.is_owner === 1) {
    return { error: "لا يمكن حذف صاحب المنصّة. انقل الملكية أولاً." };
  }

  await execute(`UPDATE profiles SET role = 'student' WHERE id = ?`, [userId]);

  revalidatePath("/admin/admins");
  return { error: null, success: `أُزيلت صلاحية الإدارة عن ${target.full_name}.` };
}

export type AdminAccount = {
  id: string;
  fullName: string;
  email: string | null;
  isOwner: boolean;
  createdAt: string;
  lastSeenAt: string | null;
};

/** Every administrator, for the owner's overview. */
export async function listAdmins(): Promise<AdminAccount[]> {
  await requireRouteAccess("/admin");

  const rows = await query<{
    id: string;
    full_name: string;
    email: string | null;
    is_owner: number;
    created_at: string;
    last_seen_at: string | null;
  }>(
    /*
      "Last seen" is the newest live session rather than a stored
      column — there is no last_login field, and sessions already know.
      An admin with no live session shows a dash, which is the truth:
      they are not signed in anywhere right now.
    */
    `SELECT p.id, p.full_name, u.email, p.is_owner, p.created_at,
            (SELECT MAX(s.created_at) FROM sessions s
              WHERE s.user_id = p.id AND s.expires_at > UTC_TIMESTAMP(3)
            ) AS last_seen_at
       FROM profiles p
       LEFT JOIN users u ON u.id = p.id
      WHERE p.role = 'admin' AND p.deleted_at IS NULL
      ORDER BY p.is_owner DESC, p.created_at ASC`
  );

  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    isOwner: r.is_owner === 1,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
  }));
}

/** Whether the signed-in admin is the owner — decides what the page offers. */
export async function viewerIsOwner(): Promise<boolean> {
  return (await requireOwner()) !== null;
}
