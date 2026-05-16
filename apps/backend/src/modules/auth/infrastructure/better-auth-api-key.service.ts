import type {
	ApiKeyMetadataDto,
	ApiKeyService,
	CreateApiKeyInput,
	CreateApiKeyResult,
	VerifyApiKeyResult,
} from "../application/api-key.service";

type BetterAuthApiKeyRecord = {
	id: string;
	name?: string | null;
	prefix?: string | null;
	createdAt?: Date | string | null;
	lastUsedAt?: Date | string | null;
	expiresAt?: Date | string | null;
	enabled?: boolean;
	disabled?: boolean;
};

type BetterAuthCreateApiKeyResponse = {
	key: string;
	metadata: BetterAuthApiKeyRecord;
};

type BetterAuthListApiKeysResponse = {
	apiKeys: BetterAuthApiKeyRecord[];
};

type BetterAuthVerifyApiKeyResponse = {
	valid: boolean;
	key: Pick<BetterAuthApiKeyRecord, "id"> | null;
	userId?: string;
};

type BetterAuthApi = {
	createApiKey: (input: {
		body: { name: string; userId: string; expiresIn?: number };
	}) => Promise<BetterAuthCreateApiKeyResponse>;
	listApiKeys: (input: {
		query: { userId: string };
	}) => Promise<BetterAuthListApiKeysResponse>;
	verifyApiKey: (input: {
		body: { key: string };
	}) => Promise<BetterAuthVerifyApiKeyResponse>;
	updateApiKey: (input: {
		body: { keyId: string; userId: string; enabled: boolean };
	}) => Promise<unknown>;
	deleteApiKey: (input: { body: { keyId: string; userId: string } }) => Promise<unknown>;
};

function toDateString(value: Date | string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const date = value instanceof Date ? value : new Date(value);

	if (!Number.isFinite(date.getTime())) {
		return null;
	}

	return date.toISOString();
}

function mapStatus(record: BetterAuthApiKeyRecord): ApiKeyMetadataDto["status"] {
	if (record.enabled === false || record.disabled === true) {
		return "revoked";
	}

	const expiresAt = toDateString(record.expiresAt);
	if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
		return "expired";
	}

	return "active";
}

function mapMetadata(record: BetterAuthApiKeyRecord): ApiKeyMetadataDto {
	return {
		id: record.id,
		name: record.name ?? "",
		prefix: record.prefix ?? null,
		created_at: toDateString(record.createdAt) ?? new Date(0).toISOString(),
		last_used_at: toDateString(record.lastUsedAt),
		expires_at: toDateString(record.expiresAt),
		status: mapStatus(record),
	};
}

export class BetterAuthApiKeyService implements ApiKeyService {
	constructor(private readonly api: Pick<BetterAuthApi, "createApiKey" | "listApiKeys" | "verifyApiKey" | "updateApiKey" | "deleteApiKey">) {}

	async create(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
		const result = await this.api.createApiKey({
			body: {
				name: input.name,
				userId: input.userId,
				expiresIn: input.expiresInSeconds,
			},
		});

		return {
			key: result.key,
			apiKey: mapMetadata(result.metadata),
		};
	}

	async list(userId: string): Promise<ApiKeyMetadataDto[]> {
		const result = await this.api.listApiKeys({ query: { userId } });
		return result.apiKeys.map(mapMetadata);
	}

	async revoke(input: { userId: string; apiKeyId: string }): Promise<boolean> {
		await this.api.updateApiKey({
			body: {
				keyId: input.apiKeyId,
				userId: input.userId,
				enabled: false,
			},
		});

		return true;
	}

	async verify(key: string): Promise<VerifyApiKeyResult> {
		const result = await this.api.verifyApiKey({ body: { key } });

		if (!result.valid || !result.userId || !result.key?.id) {
			return { valid: false };
		}

		return {
			valid: true,
			userId: result.userId,
			apiKeyId: result.key.id,
		};
	}
}
