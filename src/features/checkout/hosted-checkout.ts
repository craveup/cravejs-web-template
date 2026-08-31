import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "@/lib/storefront/action-input";

export interface PrepareCheckoutInput {
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface PrepareCheckoutResponse {
  readonly checkoutUrl: string;
  readonly expiresAt: string;
}

export type PrepareCheckout = (
  input: PrepareCheckoutInput,
) => Promise<PrepareCheckoutResponse>;

export type NavigateTopLevel = (opaqueUrl: string) => void;

export interface HostedCheckoutValidation {
  readonly cart: "valid";
  readonly customer: "valid";
  readonly fulfillment: "valid";
  readonly location: "valid";
  readonly schedule: "valid";
}

export interface HostedCheckoutAttemptInput extends PrepareCheckoutInput {
  readonly attemptId: string;
  readonly validation: HostedCheckoutValidation;
}

export type HostedCheckoutIssueCode =
  | "INVALID_ATTEMPT"
  | "INVALID_CONTEXT"
  | "CHECKOUT_NOT_READY"
  | "ATTEMPT_CONTEXT_CHANGED"
  | "INVALID_CHECKOUT_RESPONSE"
  | "INVALID_CHECKOUT_URL"
  | "UNAPPROVED_CHECKOUT_ORIGIN"
  | "INVALID_HANDOFF_EXPIRY"
  | "HANDOFF_EXPIRED"
  | "PREPARE_FAILED"
  | "PREPARE_OUTCOME_UNKNOWN"
  | "NAVIGATION_FAILED";

export type HostedCheckoutMessageKey =
  | "checkout.handoff.invalidAttempt"
  | "checkout.handoff.invalidContext"
  | "checkout.handoff.notReady"
  | "checkout.handoff.contextChanged"
  | "checkout.handoff.invalidResponse"
  | "checkout.handoff.invalidUrl"
  | "checkout.handoff.unapprovedOrigin"
  | "checkout.handoff.invalidExpiry"
  | "checkout.handoff.expired"
  | "checkout.handoff.prepareFailed"
  | "checkout.handoff.outcomeUnknown"
  | "checkout.handoff.navigationFailed";

export interface HostedCheckoutIssue {
  readonly code: HostedCheckoutIssueCode;
  readonly messageKey: HostedCheckoutMessageKey;
  readonly requestId?: string;
}

export type HostedCheckoutSnapshot =
  | Readonly<{ state: "editing" }>
  | Readonly<{ state: "validating" }>
  | Readonly<{ state: "preparing" }>
  | Readonly<{ state: "handoff-ready"; expiresAt: string }>
  | Readonly<{ state: "opening" }>
  | Readonly<{ state: "handed-off" }>
  | Readonly<{ state: "canceled-before-open" }>
  | Readonly<{ state: "failed"; issue: HostedCheckoutIssue }>
  | Readonly<{ state: "outcome-unknown"; issue: HostedCheckoutIssue }>;

export interface HostedCheckoutHandoff {
  getSnapshot(): HostedCheckoutSnapshot;
  subscribe(listener: () => void): () => void;
  prepare(input: HostedCheckoutAttemptInput): Promise<HostedCheckoutSnapshot>;
  open(): HostedCheckoutSnapshot;
  cancel(): HostedCheckoutSnapshot;
  reset(): HostedCheckoutSnapshot;
  dispose(): void;
}

type CancelScheduledWork = () => void;
type ScheduleWork = (
  callback: () => void,
  delayMs: number,
) => CancelScheduledWork;

export interface CreateHostedCheckoutHandoffInput {
  readonly checkoutOrigins: readonly string[];
  readonly prepareCheckout: PrepareCheckout;
  readonly navigateTopLevel: NavigateTopLevel;
  readonly now?: () => number;
  readonly scheduleWork?: ScheduleWork;
}

interface RetainedAttempt {
  readonly input: HostedCheckoutAttemptInput;
  readonly fingerprint: string;
  checkoutUrl?: string;
  expiresAtMs?: number;
}

interface SafeTransportError {
  readonly state?: unknown;
  readonly code?: unknown;
  readonly requestId?: unknown;
}

const safeIdentifierPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const safeRequestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const contractDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const maximumTimerDelayMs = 2_147_483_647;
const validationFields = [
  "cart",
  "customer",
  "fulfillment",
  "location",
  "schedule",
] as const;

function defaultScheduleWork(
  callback: () => void,
  delayMs: number,
): CancelScheduledWork {
  const timer = globalThis.setTimeout(callback, delayMs);
  return () => globalThis.clearTimeout(timer);
}

function issue(
  code: HostedCheckoutIssueCode,
  messageKey: HostedCheckoutMessageKey,
  requestId?: string,
): HostedCheckoutIssue {
  return Object.freeze({
    code,
    messageKey,
    ...(requestId ? { requestId } : {}),
  });
}

function failed(checkoutIssue: HostedCheckoutIssue): HostedCheckoutSnapshot {
  return Object.freeze({ state: "failed", issue: checkoutIssue });
}

function snapshot<T extends HostedCheckoutSnapshot>(value: T): T {
  return Object.freeze(value);
}

function safeRequestId(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const requestId = (error as SafeTransportError).requestId;
  return typeof requestId === "string" && safeRequestIdPattern.test(requestId)
    ? requestId
    : undefined;
}

function hasUnknownOutcome(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const transportError = error as SafeTransportError;
  return (
    transportError.state === "network-error" ||
    transportError.state === "operation-pending" ||
    transportError.code === "REQUEST_TIMEOUT" ||
    transportError.code === "NETWORK_ERROR" ||
    transportError.code === "IDEMPOTENCY_IN_PROGRESS"
  );
}

function isRealCalendarDate(dateTime: string): boolean {
  const match = contractDateTimePattern.exec(dateTime);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

function validateAllowedOrigins(origins: readonly string[]): ReadonlySet<string> {
  if (origins.length === 0) {
    throw new Error("Hosted checkout requires an exact approved origin.");
  }

  const allowed = new Set<string>();
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("Hosted checkout origin configuration is invalid.");
    }
    if (
      origin !== parsed.origin ||
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== "" ||
      parsed.hostname.includes("*") ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      throw new Error("Hosted checkout origin configuration is invalid.");
    }
    allowed.add(origin);
  }
  if (allowed.size !== origins.length) {
    throw new Error("Hosted checkout origin configuration is invalid.");
  }
  return allowed;
}

function cloneAttempt(input: HostedCheckoutAttemptInput): HostedCheckoutAttemptInput {
  return Object.freeze({
    attemptId: input.attemptId,
    locationId: input.locationId,
    cartId: input.cartId,
    revision: input.revision,
    idempotencyKey: input.idempotencyKey,
    validation: Object.freeze({ ...input.validation }),
  });
}

function attemptFingerprint(input: HostedCheckoutAttemptInput): string {
  return JSON.stringify([
    input.attemptId,
    input.locationId,
    input.cartId,
    input.revision,
    input.idempotencyKey,
    input.validation.cart,
    input.validation.customer,
    input.validation.fulfillment,
    input.validation.location,
    input.validation.schedule,
  ]);
}

function validateAttempt(
  input: HostedCheckoutAttemptInput,
): HostedCheckoutIssue | null {
  if (
    !safeIdentifierPattern.test(input.attemptId) ||
    !isStorefrontIdempotencyKey(input.idempotencyKey)
  ) {
    return issue(
      "INVALID_ATTEMPT",
      "checkout.handoff.invalidAttempt",
    );
  }
  if (
    !safeIdentifierPattern.test(input.locationId) ||
    !safeIdentifierPattern.test(input.cartId) ||
    !isStorefrontRevision(input.revision)
  ) {
    return issue(
      "INVALID_CONTEXT",
      "checkout.handoff.invalidContext",
    );
  }
  if (
    typeof input.validation !== "object" ||
    input.validation === null ||
    validationFields.some((field) => input.validation[field] !== "valid")
  ) {
    return issue("CHECKOUT_NOT_READY", "checkout.handoff.notReady");
  }
  return null;
}

function rawAuthority(checkoutUrl: string): string | null {
  const match = /^https:\/\/([^/?#]+)/i.exec(checkoutUrl);
  return match?.[1] ?? null;
}

function hasExplicitPort(authority: string): boolean {
  if (!authority.startsWith("[")) return authority.includes(":");
  const closingBracket = authority.indexOf("]");
  return (
    closingBracket === -1 || authority.slice(closingBracket + 1).startsWith(":")
  );
}

function validateCheckoutUrl(
  checkoutUrl: unknown,
  allowedOrigins: ReadonlySet<string>,
): HostedCheckoutIssue | null {
  if (
    typeof checkoutUrl !== "string" ||
    checkoutUrl.length === 0 ||
    checkoutUrl.trim() !== checkoutUrl ||
    checkoutUrl.includes("\\") ||
    /[\u0000-\u0020\u007f]/.test(checkoutUrl)
  ) {
    return issue("INVALID_CHECKOUT_URL", "checkout.handoff.invalidUrl");
  }

  let parsed: URL;
  try {
    parsed = new URL(checkoutUrl);
  } catch {
    return issue("INVALID_CHECKOUT_URL", "checkout.handoff.invalidUrl");
  }
  const authority = rawAuthority(checkoutUrl);
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    authority === null ||
    authority.includes("@") ||
    hasExplicitPort(authority)
  ) {
    return issue("INVALID_CHECKOUT_URL", "checkout.handoff.invalidUrl");
  }
  if (!allowedOrigins.has(parsed.origin)) {
    return issue(
      "UNAPPROVED_CHECKOUT_ORIGIN",
      "checkout.handoff.unapprovedOrigin",
    );
  }
  return null;
}

function validatePrepareResponse(
  response: unknown,
  allowedOrigins: ReadonlySet<string>,
  now: number,
):
  | Readonly<{
      checkoutUrl: string;
      expiresAt: string;
      expiresAtMs: number;
    }>
  | HostedCheckoutIssue {
  if (typeof response !== "object" || response === null) {
    return issue(
      "INVALID_CHECKOUT_RESPONSE",
      "checkout.handoff.invalidResponse",
    );
  }
  const candidate = response as Partial<PrepareCheckoutResponse>;
  const urlIssue = validateCheckoutUrl(candidate.checkoutUrl, allowedOrigins);
  if (urlIssue) return urlIssue;
  if (
    typeof candidate.expiresAt !== "string" ||
    !isRealCalendarDate(candidate.expiresAt)
  ) {
    return issue(
      "INVALID_HANDOFF_EXPIRY",
      "checkout.handoff.invalidExpiry",
    );
  }
  const expiresAtMs = Date.parse(candidate.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return issue(
      "INVALID_HANDOFF_EXPIRY",
      "checkout.handoff.invalidExpiry",
    );
  }
  if (expiresAtMs <= now) {
    return issue("HANDOFF_EXPIRED", "checkout.handoff.expired");
  }
  return Object.freeze({
    checkoutUrl: candidate.checkoutUrl as string,
    expiresAt: candidate.expiresAt,
    expiresAtMs,
  });
}

function isIssue(
  value:
    | Readonly<{
        checkoutUrl: string;
        expiresAt: string;
        expiresAtMs: number;
      }>
    | HostedCheckoutIssue,
): value is HostedCheckoutIssue {
  return "code" in value;
}

class HostedCheckoutHandoffImpl implements HostedCheckoutHandoff {
  private currentSnapshot: HostedCheckoutSnapshot = snapshot({
    state: "editing",
  });
  private readonly listeners = new Set<() => void>();
  private retainedAttempt: RetainedAttempt | undefined;
  private activePromise: Promise<HostedCheckoutSnapshot> | undefined;
  private activeFingerprint: string | undefined;
  private uncertainAttemptFingerprint: string | undefined;
  private cancelExpiry: CancelScheduledWork | undefined;
  private generation = 0;
  private disposed = false;

  constructor(
    private readonly allowedOrigins: ReadonlySet<string>,
    private readonly prepareCheckout: PrepareCheckout,
    private readonly navigateTopLevel: NavigateTopLevel,
    private readonly now: () => number,
    private readonly scheduleWork: ScheduleWork,
  ) {}

  getSnapshot = (): HostedCheckoutSnapshot => this.currentSnapshot;

  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  prepare = (
    sourceInput: HostedCheckoutAttemptInput,
  ): Promise<HostedCheckoutSnapshot> => {
    if (this.disposed) return Promise.resolve(this.currentSnapshot);
    const input = cloneAttempt(sourceInput);
    const fingerprint = attemptFingerprint(input);

    if (this.activePromise) {
      if (fingerprint === this.activeFingerprint) return this.activePromise;
      if (this.uncertainAttemptFingerprint) {
        return Promise.resolve(this.currentSnapshot);
      }
      return Promise.resolve(this.invalidateContext());
    }

    if (this.currentSnapshot.state === "handoff-ready") {
      if (this.isRetainedHandoffExpired()) return Promise.resolve(this.currentSnapshot);
      if (fingerprint === this.retainedAttempt?.fingerprint) {
        return Promise.resolve(this.currentSnapshot);
      }
      return Promise.resolve(this.invalidateContext());
    }

    if (this.currentSnapshot.state === "outcome-unknown") {
      if (fingerprint !== this.retainedAttempt?.fingerprint) {
        return Promise.resolve(this.currentSnapshot);
      }
      return this.startPrepare(this.retainedAttempt.input);
    }

    if (this.currentSnapshot.state !== "editing") {
      return Promise.resolve(this.currentSnapshot);
    }
    return this.startPrepare(input);
  };

  open = (): HostedCheckoutSnapshot => {
    if (this.currentSnapshot.state !== "handoff-ready") {
      return this.currentSnapshot;
    }
    if (this.isRetainedHandoffExpired()) return this.currentSnapshot;

    const checkoutUrl = this.retainedAttempt?.checkoutUrl;
    if (!checkoutUrl) {
      return this.fail(
        issue(
          "INVALID_CHECKOUT_RESPONSE",
          "checkout.handoff.invalidResponse",
        ),
      );
    }

    this.setSnapshot(snapshot({ state: "opening" }));
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    try {
      this.navigateTopLevel(checkoutUrl);
      this.setSnapshot(snapshot({ state: "handed-off" }));
    } catch {
      this.setSnapshot(
        failed(
          issue(
            "NAVIGATION_FAILED",
            "checkout.handoff.navigationFailed",
          ),
        ),
      );
    }
    return this.currentSnapshot;
  };

  cancel = (): HostedCheckoutSnapshot => {
    if (
      this.currentSnapshot.state === "handed-off" ||
      this.uncertainAttemptFingerprint !== undefined
    ) {
      return this.currentSnapshot;
    }
    this.generation += 1;
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    this.setSnapshot(snapshot({ state: "canceled-before-open" }));
    return this.currentSnapshot;
  };

  reset = (): HostedCheckoutSnapshot => {
    if (
      this.currentSnapshot.state === "handed-off" ||
      this.uncertainAttemptFingerprint !== undefined
    ) {
      return this.currentSnapshot;
    }
    this.generation += 1;
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    this.setSnapshot(snapshot({ state: "editing" }));
    return this.currentSnapshot;
  };

  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    if (this.currentSnapshot.state !== "handed-off") {
      this.setSnapshot(snapshot({ state: "canceled-before-open" }));
    }
    this.listeners.clear();
  };

  private startPrepare(
    input: HostedCheckoutAttemptInput,
  ): Promise<HostedCheckoutSnapshot> {
    this.setSnapshot(snapshot({ state: "validating" }));
    const inputIssue = validateAttempt(input);
    if (inputIssue) return Promise.resolve(this.fail(inputIssue));

    const retainedInput = cloneAttempt(input);
    const fingerprint = attemptFingerprint(retainedInput);
    this.retainedAttempt = { input: retainedInput, fingerprint };
    const generation = ++this.generation;
    this.setSnapshot(snapshot({ state: "preparing" }));

    let transportPromise: Promise<PrepareCheckoutResponse>;
    try {
      transportPromise = Promise.resolve(
        this.prepareCheckout({
          locationId: retainedInput.locationId,
          cartId: retainedInput.cartId,
          revision: retainedInput.revision,
          idempotencyKey: retainedInput.idempotencyKey,
        }),
      );
    } catch (error) {
      return Promise.resolve(this.handlePrepareError(error, generation));
    }

    const promise = transportPromise
      .then((response) => this.handlePrepareResponse(response, generation))
      .catch((error: unknown) => this.handlePrepareError(error, generation))
      .finally(() => {
        if (this.activePromise === promise) {
          this.activePromise = undefined;
          this.activeFingerprint = undefined;
        }
      });
    this.activePromise = promise;
    this.activeFingerprint = fingerprint;
    return promise;
  }

  private handlePrepareResponse(
    response: PrepareCheckoutResponse,
    generation: number,
  ): HostedCheckoutSnapshot {
    if (generation !== this.generation || !this.retainedAttempt) {
      return this.currentSnapshot;
    }
    const validatedResponse = validatePrepareResponse(
      response,
      this.allowedOrigins,
      this.now(),
    );
    if (isIssue(validatedResponse)) return this.fail(validatedResponse);

    this.retainedAttempt.checkoutUrl = validatedResponse.checkoutUrl;
    this.retainedAttempt.expiresAtMs = validatedResponse.expiresAtMs;
    this.uncertainAttemptFingerprint = undefined;
    this.setSnapshot(
      snapshot({
        state: "handoff-ready",
        expiresAt: validatedResponse.expiresAt,
      }),
    );
    this.armExpiryTimer(generation);
    return this.currentSnapshot;
  }

  private handlePrepareError(
    error: unknown,
    generation: number,
  ): HostedCheckoutSnapshot {
    if (generation !== this.generation || !this.retainedAttempt) {
      return this.currentSnapshot;
    }
    this.clearPreparedResponse();
    const requestId = safeRequestId(error);
    if (hasUnknownOutcome(error)) {
      this.uncertainAttemptFingerprint = this.retainedAttempt.fingerprint;
      this.setSnapshot(
        snapshot({
          state: "outcome-unknown",
          issue: issue(
            "PREPARE_OUTCOME_UNKNOWN",
            "checkout.handoff.outcomeUnknown",
            requestId,
          ),
        }),
      );
      return this.currentSnapshot;
    }
    return this.fail(
      issue(
        "PREPARE_FAILED",
        "checkout.handoff.prepareFailed",
        requestId,
      ),
    );
  }

  private invalidateContext(): HostedCheckoutSnapshot {
    this.generation += 1;
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    this.setSnapshot(
      failed(
        issue(
          "ATTEMPT_CONTEXT_CHANGED",
          "checkout.handoff.contextChanged",
        ),
      ),
    );
    return this.currentSnapshot;
  }

  private fail(checkoutIssue: HostedCheckoutIssue): HostedCheckoutSnapshot {
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    this.setSnapshot(failed(checkoutIssue));
    return this.currentSnapshot;
  }

  private isRetainedHandoffExpired(): boolean {
    const expiresAtMs = this.retainedAttempt?.expiresAtMs;
    if (expiresAtMs === undefined || expiresAtMs > this.now()) return false;
    this.expireRetainedHandoff();
    return true;
  }

  private expireRetainedHandoff(): void {
    this.clearExpiryTimer();
    this.dropRetainedAttempt();
    this.setSnapshot(
      failed(issue("HANDOFF_EXPIRED", "checkout.handoff.expired")),
    );
  }

  private armExpiryTimer(generation: number): void {
    this.clearExpiryTimer();
    const expiresAtMs = this.retainedAttempt?.expiresAtMs;
    if (expiresAtMs === undefined) return;
    const remaining = expiresAtMs - this.now();
    if (remaining <= 0) {
      this.expireRetainedHandoff();
      return;
    }
    this.cancelExpiry = this.scheduleWork(
      () => {
        this.cancelExpiry = undefined;
        if (
          generation !== this.generation ||
          this.currentSnapshot.state !== "handoff-ready"
        ) {
          return;
        }
        if (this.isRetainedHandoffExpired()) return;
        this.armExpiryTimer(generation);
      },
      Math.min(remaining, maximumTimerDelayMs),
    );
  }

  private clearExpiryTimer(): void {
    this.cancelExpiry?.();
    this.cancelExpiry = undefined;
  }

  private clearPreparedResponse(): void {
    if (!this.retainedAttempt) return;
    this.retainedAttempt.checkoutUrl = undefined;
    this.retainedAttempt.expiresAtMs = undefined;
  }

  private dropRetainedAttempt(): void {
    this.clearPreparedResponse();
    this.retainedAttempt = undefined;
    this.uncertainAttemptFingerprint = undefined;
  }

  private setSnapshot(next: HostedCheckoutSnapshot): void {
    this.currentSnapshot = next;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Listener failures cannot change checkout state or expose retained data.
      }
    }
  }
}

export function createHostedCheckoutHandoff(
  input: CreateHostedCheckoutHandoffInput,
): HostedCheckoutHandoff {
  return new HostedCheckoutHandoffImpl(
    validateAllowedOrigins(input.checkoutOrigins),
    input.prepareCheckout,
    input.navigateTopLevel,
    input.now ?? Date.now,
    input.scheduleWork ?? defaultScheduleWork,
  );
}
