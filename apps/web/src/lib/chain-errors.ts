/** A send that failed before anything went to the network (a read or the simulation refused it): safe to retry at once. */
export class NotSentError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "NotSentError";
  }
}
