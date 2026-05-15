import type { AuthSessionService } from "./application/auth-session.service";
import { requireSession } from "./presentation/session-guard";

export class AuthModule {
	constructor(readonly sessionService: AuthSessionService) {}

	createRequireSessionPlugin() {
		return requireSession(this.sessionService);
	}
}
