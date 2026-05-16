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
	lastRequest?: Date | string | null;
	expiresAt?: Date | string | null;
	enabled?: boolean;
	disabled?: boolean;
	referenceId?: string | null;
};

type BetterAuthCreateApiKeyResponse = BetterAuthApiKeyRecord & {
	key: string;
};

type BetterAuthListApiKeysResponse = {
	apiKeys: BetterAuthApiKeyRecord[];
};

type BetterAuthVerifyApiKeyResponse = {
	valid: boolean;
	key: Pick<BetterAuthApiKeyRecord, "id" | "referenceId"> | null;
};

type BetterAuthApi = {
	createApiKey: (input: {
		body: { name: string; userId: string; expiresIn?: number };
	}) => Promise<BetterAuthCreateApiKeyResponse>;
	listApiKeys: (input: { query: Record<string, never>; headers?: Headers }) => Promise<BetterAuthListApiKeysResponse>;
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
		last_used_at: toDateString(record.lastUsedAt ?? record.lastRequest),
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
			apiKey: mapMetadata(result),
		};
	}

	async list(input: { userId: string; headers?: Headers }): Promise<ApiKeyMetadataDto[]> {
		const result = await this.api.listApiKeys({ query: {}, headers: input.headers });
		return result.apiKeys.map(mapMetadata);
	}

	async revoke(input: { userId: string; apiKeyId: string }): Promise<boolean> {
		try {
			await this.api.updateApiKey({
				body: {
					keyId: input.apiKeyId,
					userId: input.userId,
					enabled: false,
				},
			});
		} catch (error) {
			if (isApiKeyNotFoundError(error)) {
				return false;
			}

			throw error;
		}

		return true;
	}

	async verify(key: string): Promise<VerifyApiKeyResult> {
		const result = await this.api.verifyApiKey({ body: { key } });

		const userId = result.key?.referenceId;

		if (!result.valid || !userId || !result.key?.id) {
			return { valid: false };
		}

		return {
			valid: true,
			userId,
			apiKeyId: result.key.id,
		};
	}
}

function isApiKeyNotFoundError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const candidate = error as {
		status?: unknown;
		statusCode?: unknown;
		body?: { code?: unknown; message?: unknown };
	};

	return (
		candidate.status === "NOT_FOUND" ||
		candidate.statusCode === 404 ||
		candidate.body?.code === "KEY_NOT_FOUND" ||
		candidate.body?.message === "API Key not found"
	);
}
