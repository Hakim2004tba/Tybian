/**
 * How anything on the page asks the assistant a question.
 *
 * The reader's highlight popover needs to say "explain this" about the
 * sentence a student just selected. The assistant is mounted in the
 * root layout, far from the reader in the tree, and lifting its state
 * into a context to connect them would make every page pay for a wire
 * only one page uses.
 *
 *   askAi(`اشرح لي: "${selection}"`)
 *
 * One event, one listener. Either side can be removed without the
 * other noticing.
 */
export const AI_ASK_EVENT = "tibyan:ai-ask";

export function askAi(question: string): void {
  window.dispatchEvent(new CustomEvent(AI_ASK_EVENT, { detail: { question } }));
}
