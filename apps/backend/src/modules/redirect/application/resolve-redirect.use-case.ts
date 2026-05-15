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
      this.deps.clickEventRepository.create({
        linkId: link.id,
        clickedAt: now,
        referrerDomain: extractReferrerDomain(input.request),
        country: null,
        browser: null,
        os: null,
        device: null,
        isBot: false,
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
