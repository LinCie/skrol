import type { ClickEventRepository } from "./click-event.repository";
import type { ClockPort } from "./clock.port";
import type { RedirectLinkLookupPort } from "./redirect-link-lookup.port";
import type { RedirectLoggerPort } from "./redirect-logger.port";

export interface ResolveRedirectInput {
  code: string;
  request?: Request;
}

export interface ResolveRedirectDecision {
  status: 302 | 404 | 410;
  location?: string;
}

export interface ResolveRedirectUseCaseDependencies {
  lookup: RedirectLinkLookupPort;
  clickEventRepository: ClickEventRepository;
  clock: ClockPort;
  logger: RedirectLoggerPort;
}

function extractReferrerDomain(request?: Request): string | null {
  if (!request) {
    return null;
  }

  const referrer =
    request.headers.get("referer") ?? request.headers.get("referrer");
  if (!referrer) {
    return null;
  }

  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeNullableLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getUserAgent(request?: Request): string {
  return request?.headers.get("user-agent") ?? "";
}

function detectBrowserFamily(userAgent: string): string | null {
  if (!userAgent) {
    return null;
  }

  if (/Edg\//i.test(userAgent)) {
    return "Edge";
  }

  if (/EdgiOS\//i.test(userAgent)) {
    return "Edge";
  }

  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) {
    return "Opera";
  }

  if (/OPiOS\//i.test(userAgent)) {
    return "Opera";
  }

  if (/Firefox\//i.test(userAgent)) {
    return "Firefox";
  }

  if (/FxiOS\//i.test(userAgent)) {
    return "Firefox";
  }

  if (/CriOS\//i.test(userAgent)) {
    return "Chrome";
  }

  if (
    (/Chrome\//i.test(userAgent) || /Chromium\//i.test(userAgent)) &&
    !/Edg\//i.test(userAgent) &&
    !/EdgiOS\//i.test(userAgent) &&
    !/OPR\//i.test(userAgent) &&
    !/Opera/i.test(userAgent) &&
    !/CriOS\//i.test(userAgent)
  ) {
    return "Chrome";
  }

  if (
    /Safari\//i.test(userAgent) &&
    /Version\//i.test(userAgent) &&
    !/Chrome\//i.test(userAgent) &&
    !/Chromium\//i.test(userAgent)
  ) {
    return "Safari";
  }

  return null;
}

function detectOsFamily(userAgent: string): string | null {
  if (!userAgent) {
    return null;
  }

  const isIpadOs = /Macintosh/i.test(userAgent) && /Mobile\//i.test(userAgent);

  if (/Windows NT/i.test(userAgent)) {
    return "Windows";
  }

  if (/Mac OS X/i.test(userAgent) && !/iPhone|iPad|iPod/i.test(userAgent) && !isIpadOs) {
    return "macOS";
  }

  if (/Android/i.test(userAgent)) {
    return "Android";
  }

  if (/iPhone|iPad|iPod/i.test(userAgent) || isIpadOs) {
    return "iOS";
  }

  if (/Linux/i.test(userAgent)) {
    return "Linux";
  }

  return null;
}

function detectDeviceFamily(userAgent: string): string | null {
  if (!userAgent) {
    return null;
  }

  const isIpadOs = /Macintosh/i.test(userAgent) && /Mobile\//i.test(userAgent);

  if (/iPad/i.test(userAgent) || isIpadOs) {
    return "tablet";
  }

  if (/Mobile|iPhone|iPod|Android/i.test(userAgent)) {
    return "mobile";
  }

  return "desktop";
}

function detectBot(userAgent: string): boolean {
  if (!userAgent) {
    return false;
  }

  return /bot|crawler|spider|slurp|preview|wget|curl|python-requests/i.test(
    userAgent,
  );
}

export class ResolveRedirectUseCase {
  constructor(private readonly deps: ResolveRedirectUseCaseDependencies) {}

  async execute(input: ResolveRedirectInput): Promise<ResolveRedirectDecision> {
    const startedAt = performance.now();
    const now = this.deps.clock.now();
    const normalizedCode = input.code.trim().toLowerCase();

    const link = await this.deps.lookup.findByCode(normalizedCode);
    if (!link) {
      this.deps.logger.info(
        {
          code: normalizedCode,
          status: 404,
          durationMs: performance.now() - startedAt,
        },
        "redirect decision",
      );
      return { status: 404 };
    }

    const effectiveState = link.stateAt(now);
    if (effectiveState === "deleted") {
      this.deps.logger.info(
        {
          code: normalizedCode,
          linkId: link.id,
          effectiveState,
          status: 404,
          durationMs: performance.now() - startedAt,
        },
        "redirect decision",
      );
      return { status: 404 };
    }

    if (effectiveState !== "active") {
      this.deps.logger.info(
        {
          code: normalizedCode,
          linkId: link.id,
          effectiveState,
          status: 410,
          durationMs: performance.now() - startedAt,
        },
        "redirect decision",
      );
      return { status: 410 };
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("analytics_timeout")), 50);
    });

    await Promise.race([
      // Capture normalized click metadata without blocking redirect response.
      this.deps.clickEventRepository.create({
        linkId: link.id,
        clickedAt: now,
        referrerDomain: extractReferrerDomain(input.request),
        country: null,
        browser: normalizeNullableLabel(
          detectBrowserFamily(getUserAgent(input.request)),
        ),
        os: normalizeNullableLabel(detectOsFamily(getUserAgent(input.request))),
        device: normalizeNullableLabel(
          detectDeviceFamily(getUserAgent(input.request)),
        ),
        isBot: detectBot(getUserAgent(input.request)),
      }),
      timeout,
    ])
      .catch((error) => {
        this.deps.logger.warn(
          {
            error,
            code: normalizedCode,
            linkId: link.id,
          },
          "click event insert failed",
        );
      })
      .finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });

    this.deps.logger.info(
      {
        code: normalizedCode,
        linkId: link.id,
        status: 302,
        durationMs: performance.now() - startedAt,
      },
      "redirect decision",
    );

    return {
      status: 302,
      location: link.destinationUrl,
    };
  }
}
