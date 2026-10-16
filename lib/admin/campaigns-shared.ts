/**
 * Constants and types for the bulk-email campaigns.
 *
 * Separate from the actions file because a `"use server"` module may
 * only export async functions — a constant or a type exported from one
 * is a build error, not a lint warning.
 */

export const CAMPAIGN_TABLES = ["email_campaigns", "campaign_recipients"];

/**
 * How many recipients one call sends to.
 *
 * Small on purpose. This runs inside a normal request on shared
 * hosting, where SMTP is slow and the request is cut off after a while;
 * a batch that cannot finish leaves nothing to show for it. Twenty is
 * comfortably inside any timeout, and the caller simply asks again
 * until there is nothing left — which also makes progress visible
 * rather than a spinner that either returns or does not.
 */
export const BATCH_SIZE = 20;

export type CampaignState = {
  error: string | null;
  success?: string;
  campaignId?: string;
};

export type BatchResult = {
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
};
