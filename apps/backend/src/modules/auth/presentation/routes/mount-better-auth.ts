import { Elysia } from "elysia";
import { BETTER_AUTH_BASE_PATH } from "@/modules/auth/application/auth-paths";

export type BetterAuthHandler = (
	request: Request,
) => Response | Promise<Response>;

export interface MountBetterAuthRoutesDependencies {
	handler: BetterAuthHandler;
}

export function mountBetterAuthRoutes(
	deps: MountBetterAuthRoutesDependencies,
) {
	const forward = ({ request }: { request: Request }) => deps.handler(request);

	return new Elysia({ name: "auth.native-routes" })
		.all(BETTER_AUTH_BASE_PATH, forward, {
			parse: "none",
		})
		.all(`${BETTER_AUTH_BASE_PATH}/*`, forward, {
			parse: "none",
		});
}
