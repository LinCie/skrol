import type { AuthPrincipal } from "./auth-principal";

export interface AuthSessionService {
	resolveFromRequest(request: Request): Promise<AuthPrincipal | null>;
}
