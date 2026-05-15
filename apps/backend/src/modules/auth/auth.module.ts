import type { AuthSessionService } from "./application/auth-session.service";
import {
	mountBetterAuthRoutes,
	type BetterAuthHandler,
} from "./presentation/routes/mount-better-auth";
import { requireSession } from "./presentation/session-guard";

export class AuthModule {
	constructor(
		readonly sessionService: AuthSessionService,
		private readonly betterAuthHandler?: BetterAuthHandler,
	) {}

	createRequireSessionPlugin() {
		return requireSession(this.sessionService);
	}

	createNativeRoutesPlugin() {
		if (!this.betterAuthHandler) {
			throw new Error("Better Auth handler is not configured.");
		}

		return mountBetterAuthRoutes({
			handler: this.betterAuthHandler,
		});
	}
}
