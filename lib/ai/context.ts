/**
 * Turns the page a student is on into a line of context for the
 * assistant.
 *
 * This is what separates a study companion from a generic chat box: a
 * student reading a lesson on potassium disorders can ask "اشرح لي
 * هذا" and be understood, because the assistant is told what "this" is.
 *
 * Only the PATH is used, never page contents, and the result is a short
 * plain sentence — nothing here can carry instructions of its own into
 * the system prompt beyond naming a location in the app.
 */

export type PageContext = {
  path: string;
  /** Human-readable title of the current lesson/course, when the page
   *  knows one. Supplied by the client, so it is treated as untrusted
   *  text: it is truncated and never interpolated as an instruction. */
  title?: string;
};

const MAX_TITLE_CHARS = 120;

export function describeContext(ctx: PageContext | null): string | null {
  if (!ctx) return null;

  const title = ctx.title?.trim().slice(0, MAX_TITLE_CHARS);
  const path = ctx.path;

  if (path.startsWith("/courses/") && path.includes("/learn")) {
    return title ? `The student is watching a lesson titled: "${title}".` : "The student is on a lesson playback page.";
  }
  if (path.startsWith("/courses/")) {
    return title ? `The student is browsing a course titled: "${title}".` : "The student is on a course page.";
  }
  if (path.startsWith("/dashboard/study")) {
    return "The student is on the study-tracking page, following their progress across subjects.";
  }
  if (path.startsWith("/dashboard/progress")) {
    return "The student is reviewing their progress and study time.";
  }
  if (path.startsWith("/dashboard")) {
    return "The student is on their dashboard.";
  }
  if (path.startsWith("/articles")) {
    return title ? `The student is reading an article titled: "${title}".` : "The student is reading an article.";
  }
  return null;
}

/** Context-aware openers. A blank box invites nothing; these give the
 *  student a first move that fits where they already are. */
export type PromptKey =
  | "lessonExplain" | "lessonQcm" | "lessonKeyPoints"
  | "studyPlan" | "studyWeekly" | "studyMemorize"
  | "generalConcept" | "generalQcm" | "generalRevise";

/**
 * Which shortcuts to offer for the page the student is on.
 *
 * Returns dictionary KEYS, not sentences. These used to be hardcoded
 * French — a language the site does not otherwise speak, so the panel
 * read as French to Arabic and English students alike. The component
 * resolves each key through dict.ai.prompts.
 */
export function suggestedPrompts(ctx: PageContext | null): PromptKey[] {
  const path = ctx?.path ?? "";

  if (path.includes("/learn")) {
    return ["lessonExplain", "lessonQcm", "lessonKeyPoints"];
  }
  if (path.startsWith("/dashboard/study")) {
    return ["studyPlan", "studyWeekly", "studyMemorize"];
  }
  return ["generalConcept", "generalQcm", "generalRevise"];
}
