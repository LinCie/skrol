export type ApiKeyStatus = "active" | "revoked" | "expired";

export interface ApiKeyMetadataDto {
	id: string;
	name: string;
	prefix: string | null;
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
	status: ApiKeyStatus;
}

export interface CreateApiKeyInput {
	userId: string;
	name: string;
	expiresInSeconds?: number;
}

export interface CreateApiKeyResult {
	key: string;
	apiKey: ApiKeyMetadataDto;
}

export interface ListApiKeysInput {
	userId: string;
	headers?: Headers;
}

export type VerifyApiKeyResult =
	| { valid: true; userId: string; apiKeyId: string }
	| { valid: false };

export interface ApiKeyService {
	create(input: CreateApiKeyInput): Promise<CreateApiKeyResult>;
	list(input: ListApiKeysInput): Promise<ApiKeyMetadataDto[]>;
	revoke(input: { userId: string; apiKeyId: string }): Promise<boolean>;
	verify(key: string): Promise<VerifyApiKeyResult>;
}
