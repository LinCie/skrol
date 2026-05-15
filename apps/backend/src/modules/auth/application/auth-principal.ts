export interface AuthPrincipal {
	userId: string;
	sessionId: string;
	authSource: "session";
}

export const AUTH_PRINCIPAL_DECORATOR = "authPrincipal" as const;
