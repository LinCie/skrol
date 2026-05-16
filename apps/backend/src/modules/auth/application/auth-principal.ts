export type AuthPrincipal =
	| {
			authSource: "session";
			userId: string;
			sessionId: string;
	  }
	| {
			authSource: "api-key";
			userId: string;
			apiKeyId: string;
	  };

export const AUTH_PRINCIPAL_DECORATOR = "authPrincipal" as const;
