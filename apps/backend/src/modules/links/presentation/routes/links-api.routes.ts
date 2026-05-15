import { Elysia } from "elysia";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { requireSession } from "@/modules/auth/presentation/session-guard";
import { normalizeAlias } from "@/modules/links/domain/alias-policy";
import type { Link } from "@/modules/links/domain/link.entity";
import type { LinksModule } from "@/modules/links/links.module";
import { apiError } from "@/modules/shared/presentation/api-error";

export interface LinksApiRoutesDependencies {
	authSessionService: AuthSessionService;
	linksModule: Pick<
		LinksModule,
		"createLinkUseCase" | "listLinksUseCase" | "getLinkDetailUseCase"
	>;
}

const API_ALIAS_REGEX = /^[a-z0-9_-]{3,64}$/;

export function linksApiRoutes(deps: LinksApiRoutesDependencies) {
	return new Elysia({ name: "links.api-routes" })
		.use(requireSession(deps.authSessionService))
		.post("/api/v1/links", async ({ authPrincipal, body, request }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const createBody = parseCreateLinkBody(body);
			if (!createBody.ok) {
				return apiError(400, "validation_error", "Invalid link request.");
			}

			const result = await deps.linksModule.createLinkUseCase.execute({
				ownerUserId: authPrincipal.userId,
				actorApiKeyId: null,
				destinationUrl: createBody.destinationUrl,
				alias: createBody.alias,
				title: createBody.title,
				expiresAt: createBody.expiresAt,
			});

			if (!result.ok) {
				return createLinkError(result.code);
			}

			return Response.json(toLinkDto(result.link, request), { status: 201 });
		})
		.get("/api/v1/links", async ({ authPrincipal, request }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const url = new URL(request.url);
			const result = await deps.linksModule.listLinksUseCase.execute({
				ownerUserId: authPrincipal.userId,
				limit: parseLimit(url.searchParams.get("limit")),
				cursor: url.searchParams.get("cursor") || undefined,
			});

			return Response.json({
				items: result.items.map((link) => toLinkDto(link, request)),
				nextCursor: result.nextCursor,
			});
		})
		.get("/api/v1/links/:id", async ({ authPrincipal, params, request }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const link = await deps.linksModule.getLinkDetailUseCase.execute({
				id: params.id,
				ownerUserId: authPrincipal.userId,
			});

			if (!link) {
				return apiError(404, "not_found", "Link was not found.");
			}

			return Response.json(toLinkDto(link, request));
		});
}

type ParseCreateLinkBodyResult =
	| {
			ok: true;
			destinationUrl: string;
			alias?: string;
			title?: string;
			expiresAt: Date | null;
	  }
	| { ok: false };

function toLinkDto(link: Link, request: Request) {
	return {
		id: link.id,
		short_url: new URL(`/${link.code}`, request.url).toString(),
		code: link.code,
		destination_url: link.destinationUrl,
		title: link.title,
		status: link.status,
		expires_at: link.expiresAt?.toISOString() ?? null,
		created_at: link.createdAt.toISOString(),
	};
}

function parseLimit(value: string | null): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return 20;
	}

	return Math.min(Math.floor(parsed), 100);
}

function parseCreateLinkBody(body: unknown): ParseCreateLinkBodyResult {
	if (!body || typeof body !== "object") {
		return { ok: false };
	}

	const record = body as Record<string, unknown>;
	if (typeof record.url !== "string") {
		return { ok: false };
	}

	const expiresAt = parseExpiresAt(record.expires_at);
	if (expiresAt === false) {
		return { ok: false };
	}

	const alias = parseAlias(record.alias);
	if (alias === false) {
		return { ok: false };
	}

	return {
		ok: true,
		destinationUrl: record.url,
		alias,
		title: typeof record.title === "string" ? record.title : undefined,
		expiresAt,
	};
}

function parseAlias(value: unknown): string | undefined | false {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "string") {
		return false;
	}

	const alias = normalizeAlias(value);
	return API_ALIAS_REGEX.test(alias) ? alias : false;
}

function parseExpiresAt(value: unknown): Date | null | false {
	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value !== "string") {
		return false;
	}

	const expiresAt = new Date(value);
	if (
		!Number.isFinite(expiresAt.getTime()) ||
		!isValidRfc3339Timestamp(value) ||
		expiresAt <= new Date()
	) {
		return false;
	}

	return expiresAt;
}

function isValidRfc3339Timestamp(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/.exec(
		value,
	);
	if (!match) {
		return false;
	}

	const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
		match;
	const year = Number(yearValue);
	const month = Number(monthValue);
	const day = Number(dayValue);
	const hour = Number(hourValue);
	const minute = Number(minuteValue);
	const second = Number(secondValue);
	const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

	return (
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= maxDay &&
		hour <= 23 &&
		minute <= 59 &&
		second <= 59
	);
}

function createLinkError(code: string): Response {
	if (code === "alias_taken") {
		return apiError(409, code, "Alias is already taken.");
	}

	return apiError(400, code, "Link request is invalid.");
}
