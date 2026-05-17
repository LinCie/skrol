import { Elysia } from "elysia";
import type { ApiKeyService } from "@/modules/auth/application/api-key.service";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { requireApiPrincipal } from "@/modules/auth/presentation/api-principal-guard";
import { requireSameOriginForSessionWrite } from "@/modules/auth/presentation/session-write-origin-guard";
import { normalizeAlias } from "@/modules/links/domain/alias-policy";
import type { Link } from "@/modules/links/domain/link.entity";
import type { LinksModuleLike } from "@/modules/links/links.module";
import config from "@/shared/config";
import { apiError } from "@/shared/presentation/api-error";

export interface LinksApiRoutesDependencies {
	authSessionService: AuthSessionService;
	apiKeyService: Pick<ApiKeyService, "verify">;
	allowedOrigins: string[];
	linksModule: Pick<
			LinksModuleLike,
			| "createLinkUseCase"
			| "listLinksUseCase"
			| "getLinkDetailUseCase"
			| "updateLinkUseCase"
		| "deleteLinkUseCase"
	>;
}

const API_ALIAS_REGEX = /^[a-z0-9_-]{3,64}$/;

export function linksApiRoutes(deps: LinksApiRoutesDependencies) {
	return new Elysia({ name: "links.api-routes" })
		.use(
			requireApiPrincipal({
				apiKeyService: deps.apiKeyService,
				authSessionService: deps.authSessionService,
			}),
		)
		.use(requireSameOriginForSessionWrite({ allowedOrigins: deps.allowedOrigins }))
		.post("/api/v1/links", async ({ authPrincipal, body }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const createBody = parseCreateLinkBody(body);
			if (!createBody.ok) {
				return apiError(400, "validation_error", "Invalid link request.");
			}

			const result = await deps.linksModule.createLinkUseCase.execute({
				ownerUserId: authPrincipal.userId,
				actorApiKeyId:
					authPrincipal.authSource === "api-key" ? authPrincipal.apiKeyId : null,
				destinationUrl: createBody.destinationUrl,
				alias: createBody.alias,
				title: createBody.title,
				expiresAt: createBody.expiresAt,
			});

			if (!result.ok) {
				return createLinkError(result.code);
			}

			return Response.json(toLinkDto(result.link), { status: 201 });
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
				items: result.items.map((link) => toLinkDto(link)),
				nextCursor: result.nextCursor,
			});
		})
		.get("/api/v1/links/:id", async ({ authPrincipal, params }) => {
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

			return Response.json(toLinkDto(link));
		})
		.patch("/api/v1/links/:id", async ({ authPrincipal, body, params }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const patchBody = parseUpdateLinkBody(body);
			if (!patchBody.ok) {
				return apiError(400, "validation_error", "Invalid link request.");
			}

			const result = await deps.linksModule.updateLinkUseCase.execute({
				id: params.id,
				ownerUserId: authPrincipal.userId,
				actorApiKeyId:
					authPrincipal.authSource === "api-key" ? authPrincipal.apiKeyId : null,
				patch: patchBody.patch,
			});

			if (!result.ok) {
				return updateLinkError(result.code);
			}

			return Response.json(toLinkDto(result.link));
		})
		.delete("/api/v1/links/:id", async ({ authPrincipal, params, set }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const result = await deps.linksModule.deleteLinkUseCase.execute({
				id: params.id,
				ownerUserId: authPrincipal.userId,
				actorApiKeyId:
					authPrincipal.authSource === "api-key" ? authPrincipal.apiKeyId : null,
			});

			if (!result.ok) {
				return apiError(404, "not_found", "Link was not found.");
			}

			set.status = 204;
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

type UpdateLinkRequest = {
	title?: string | null;
	destination_url?: string;
	expires_at?: string | null;
	status?: "active" | "disabled";
};

type ParseUpdateLinkBodyResult =
	| {
			ok: true;
			patch: UpdateLinkPatch;
	  }
	| { ok: false };

type UpdateLinkPatch = {
	title?: string | null;
	destinationUrl?: string;
	expiresAt?: Date | null;
	status?: "active" | "disabled";
};

function toLinkDto(link: Link) {
	return {
		id: link.id,
		short_url: new URL(`/${link.code}`, config.publicFrontendOrigin).toString(),
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

function parseUpdateLinkBody(body: unknown): ParseUpdateLinkBodyResult {
	if (!body || typeof body !== "object") {
		return { ok: false };
	}

	const record = body as Record<string, unknown>;
	const keys = Object.keys(record);
	if (keys.length === 0 || keys.some((key) => !isUpdateLinkRequestKey(key))) {
		return { ok: false };
	}

	const patch: UpdateLinkPatch = {};
	const request = record as UpdateLinkRequest;

	if ("title" in request) {
		if (request.title !== null && typeof request.title !== "string") {
			return { ok: false };
		}
		patch.title = request.title;
	}

	if ("destination_url" in request) {
		if (typeof request.destination_url !== "string") {
			return { ok: false };
		}
		patch.destinationUrl = request.destination_url;
	}

	if ("expires_at" in request) {
		const expiresAt = parseExpiresAt(request.expires_at);
		if (expiresAt === false) {
			return { ok: false };
		}
		patch.expiresAt = expiresAt;
	}

	if ("status" in request) {
		if (request.status !== "active" && request.status !== "disabled") {
			return { ok: false };
		}
		patch.status = request.status;
	}

	return { ok: true, patch };
}

function isUpdateLinkRequestKey(key: string): key is keyof UpdateLinkRequest {
	return (
		key === "title" ||
		key === "destination_url" ||
		key === "expires_at" ||
		key === "status"
	);
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

function updateLinkError(code: string): Response {
	if (code === "not_found") {
		return apiError(404, code, "Link was not found.");
	}

	return apiError(400, code, "Link request is invalid.");
}
