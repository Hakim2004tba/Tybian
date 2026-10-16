/**
 * The one character the chat stream ends with.
 *
 * Shared by the route and the widget so the two cannot disagree about
 * what "finished" looks like. U+0004 END OF TRANSMISSION: it is not
 * text a model would ever emit, it survives being split across UTF-8
 * chunks, and it is stripped before anything is displayed.
 *
 * Its ABSENCE is the signal — see the note in app/api/ai/chat/route.ts.
 */
export const STREAM_END = "\u0004";
