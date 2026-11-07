/** Keep the newest presentation value while hidden; transaction processing
 * must happen before this buffer and is never deferred by it. */
export class VisibleValue<T> {
  private pending: { value: T } | undefined;
  constructor(private readonly apply: (value: T) => void) {}
  receive(value: T, visible: boolean) {
    this.pending = { value };
    if (visible) this.flush();
  }
  flush() {
    const latest = this.pending;
    this.pending = undefined;
    if (latest) this.apply(latest.value);
  }
}
