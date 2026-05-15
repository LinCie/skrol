import { Elysia } from "elysia";
import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import { requireSession } from "@/modules/auth/presentation/session-guard";
import type { LinksModule } from "@/modules/links/links.module";
import { apiError } from "@/modules/shared/presentation/api-error";

export interface LinksApiRoutesDependencies {
	authSessionService: AuthSessionService;
	linksModule: Pick<
		LinksModule,
		"createLinkUseCase" | "listLinksUseCase" | "getLinkDetailUseCase"
	>;
}

export function linksApiRoutes(deps: LinksApiRoutesDependencies) {
	return new Elysia({ name: "links.api-routes" })
		.use(requireSession(deps.authSessionService))
		.post("/api/v1/links", async ({ authPrincipal, body }) => {
			if (!authPrincipal) {
				return apiError(401, "unauthorized", "Authentication is required.");
			}

			const createBody = parseCreateLinkBody(body);
			if (!createBody) {
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

			return Response.json(result.link, { status: 201 });
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

			return Response.json(result);
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

			return Response.json(link);
		});
}

function parseLimit(value: string | null): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return 20;
	}

	return Math.min(Math.floor(parsed), 100);
}

function parseCreateLinkBody(body: unknown):
	| {
			destinationUrl: string;
			alias?: string;
			title?: string;
			expiresAt: Date | null;
	  }
	| null {
	if (!body || typeof body !== "object") {
		return null;
	}

	const record = body as Record<string, unknown>;
	if (typeof record.destinationUrl !== "string") {
		return null;
	}

	return {
		destinationUrl: record.destinationUrl,
		alias: typeof record.alias === "string" ? record.alias : undefined,
		title: typeof record.title === "string" ? record.title : undefined,
		expiresAt:
			typeof record.expiresAt === "string" ? new Date(record.expiresAt) : null,
	};
}

function createLinkError(code: string): Response {
	if (code === "alias_taken") {
		return apiError(409, code, "Alias is already taken.");
	}

	return apiError(400, code, "Link request is invalid.");
}
