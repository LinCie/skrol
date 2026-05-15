import type { AuthSessionService } from "@/modules/auth/application/auth-session.service";
import type { AuthPrincipal } from "@/modules/auth/application/auth-principal";

export interface BetterAuthSessionResolver {
	(request: Request): Promise<{
		session: { id: string };
		user: { id: string };
	} | null>;
}

export class BetterAuthSessionService implements AuthSessionService {
	constructor(private readonly resolveSession: BetterAuthSessionResolver) {}

	async resolveFromRequest(request: Request): Promise<AuthPrincipal | null> {
		const session = await this.resolveSession(request);

		if (!session) {
			return null;
		}

		return {
			userId: session.user.id,
			sessionId: session.session.id,
			authSource: "session",
		};
	}
}
