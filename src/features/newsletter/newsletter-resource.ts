export type NewsletterResourceState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "success" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "rate-limited"; retryAfterMs?: number }>
  | Readonly<{ status: "error" }>;

export type NewsletterTransportOutcome = Exclude<
  NewsletterResourceState,
  { readonly status: "idle" | "pending" }
>;

export type NewsletterTransport = (
  email: string,
) => NewsletterTransportOutcome | Promise<NewsletterTransportOutcome>;

export interface NewsletterResource {
  getSnapshot(): NewsletterResourceState;
  subscribe(listener: () => void): () => void;
  submit(email: string): Promise<NewsletterResourceState>;
  reset(): NewsletterResourceState;
}

const idleState = { status: "idle" } as const;
const pendingState = { status: "pending" } as const;
const errorState = { status: "error" } as const;
const maximumRetryAfterMs = 60 * 60 * 1_000;

function terminalState(outcome: NewsletterTransportOutcome): NewsletterResourceState {
  switch (outcome?.status) {
    case "success":
      return { status: "success" };
    case "invalid":
      return { status: "invalid" };
    case "rate-limited": {
      const retryAfterMs = outcome.retryAfterMs;
      return Number.isSafeInteger(retryAfterMs) &&
        retryAfterMs !== undefined &&
        retryAfterMs >= 1_000 &&
        retryAfterMs <= maximumRetryAfterMs
        ? { status: "rate-limited", retryAfterMs }
        : { status: "rate-limited" };
    }
    case "error":
    default:
      return errorState;
  }
}

class NewsletterResourceImpl implements NewsletterResource {
  private state: NewsletterResourceState = idleState;
  private readonly listeners = new Set<() => void>();
  private activePromise: Promise<NewsletterResourceState> | undefined;

  constructor(private readonly transport: NewsletterTransport) {}

  getSnapshot = (): NewsletterResourceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  submit = (email: string): Promise<NewsletterResourceState> => {
    if (this.activePromise) return this.activePromise;

    let resolveSubmission!: (state: NewsletterResourceState) => void;
    const submission = new Promise<NewsletterResourceState>((resolve) => {
      resolveSubmission = resolve;
    });
    this.activePromise = submission;
    this.setState(pendingState);

    let transportResult:
      | NewsletterTransportOutcome
      | Promise<NewsletterTransportOutcome>;
    try {
      transportResult = this.transport(email);
    } catch {
      transportResult = errorState;
    }

    void Promise.resolve(transportResult)
      .then(terminalState, () => errorState)
      .then((state) => {
        if (this.activePromise === submission) {
          this.activePromise = undefined;
        }
        this.setState(state);
        resolveSubmission(state);
      });

    return submission;
  };

  reset = (): NewsletterResourceState => {
    if (this.state.status === "pending") return this.state;
    if (this.state.status !== "idle") this.setState(idleState);
    return this.state;
  };

  private setState(state: NewsletterResourceState): void {
    this.state = state;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Observer failures cannot change newsletter state or transport behavior.
      }
    }
  }
}

export function createNewsletterResource(
  transport: NewsletterTransport,
): NewsletterResource {
  return new NewsletterResourceImpl(transport);
}
