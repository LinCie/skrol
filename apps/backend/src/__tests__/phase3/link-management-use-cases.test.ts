import { describe, expect, it } from "bun:test";
import { DeleteLinkUseCase } from "@/modules/links/application/delete-link.use-case";
import type {
	CreateLinkAuditLogInput,
	LinksRepository,
	UpdateLinkRepositoryInput,
} from "@/modules/links/application/links.repository";
import { UpdateLinkUseCase } from "@/modules/links/application/update-link.use-case";
import type { Link } from "@/modules/links/domain/link.entity";

function makeLink(overrides: Partial<Link> = {}): Link {
	const createdAt = new Date("2026-05-16T00:00:00.000Z");
	return {
		id: "link_1",
		userId: "user_1",
		createdViaApiKeyId: "key_creator",
		code: "abc123",
		destinationUrl: "https://example.com/start",
		title: "Original title",
		status: "active",
		expiresAt: null,
		deletedAt: null,
		createdAt,
		updatedAt: createdAt,
		stateAt: () => "active",
		canRedirect: () => true,
		...overrides,
	} as Link;
}

function createRepository(initialLink: Link | null = makeLink()) {
	const updates: UpdateLinkRepositoryInput[] = [];
	const auditLogs: CreateLinkAuditLogInput[] = [];
	const softDeletes: Array<{ id: string; userId: string; deletedAt: Date }> = [];

	const repository: LinksRepository = {
		codeExists: async () => false,
		findByCode: async () => null,
		createLink: async () => makeLink(),
		listByOwner: async () => ({ items: [], nextCursor: null }),
		findByIdForOwner: async () => initialLink,
		updateLinkForOwner: async (input) => {
			updates.push(input);
			if (!initialLink) {
				return null;
			}

			return makeLink({
				...initialLink,
				title: "title" in input ? input.title ?? null : initialLink.title,
				destinationUrl:
					"destinationUrl" in input
						? input.destinationUrl
						: initialLink.destinationUrl,
				expiresAt:
					"expiresAt" in input ? input.expiresAt ?? null : initialLink.expiresAt,
				status: "status" in input ? input.status : initialLink.status,
				updatedAt: input.updatedAt,
			});
		},
		softDeleteLinkForOwner: async (input) => {
			softDeletes.push(input);
			if (!initialLink) {
				return null;
			}

			return makeLink({
				...initialLink,
				status: "deleted",
				deletedAt: input.deletedAt,
				updatedAt: input.deletedAt,
			});
		},
		createAuditLog: async (input) => {
			auditLogs.push(input);
		},
	};

	return { repository, updates, auditLogs, softDeletes };
}

describe("link management use cases", () => {
	it("UpdateLinkUseCase returns not_found when owner link is missing", async () => {
		const { repository } = createRepository(null);
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_missing",
			ownerUserId: "user_1",
			actorApiKeyId: "key_1",
			patch: { title: "New title" },
		});

		expect(result).toEqual({ ok: false, code: "not_found" });
	});

	it("UpdateLinkUseCase rejects empty update bodies", async () => {
		const { repository } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: {},
		});

		expect(result).toEqual({ ok: false, code: "validation_error" });
	});

	it("UpdateLinkUseCase rejects unknown statuses", async () => {
		const { repository } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: { status: "flagged" },
		});

		expect(result).toEqual({ ok: false, code: "validation_error" });
	});

	it("UpdateLinkUseCase rejects status changes from flagged links", async () => {
		const { repository, updates } = createRepository(makeLink({ status: "flagged" }));
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: { status: "active" },
		});

		expect(result).toEqual({ ok: false, code: "validation_error" });
		expect(updates).toEqual([]);
	});

	it("UpdateLinkUseCase rejects explicit undefined title and expiration fields", async () => {
		const { repository, updates } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const titleResult = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: { title: undefined } as { title?: string | null },
		});

		const expiresAtResult = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: { expiresAt: undefined } as { expiresAt?: Date | null },
		});

		expect(titleResult).toEqual({ ok: false, code: "validation_error" });
		expect(expiresAtResult).toEqual({ ok: false, code: "validation_error" });
		expect(updates).toEqual([]);
	});

	it("UpdateLinkUseCase rejects patches without recognized update fields", async () => {
		const { repository, updates } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: { unknown: "value" } as never,
		});

		expect(result).toEqual({ ok: false, code: "validation_error" });
		expect(updates).toEqual([]);
	});

	it("UpdateLinkUseCase rejects unsafe destination URLs", async () => {
		const { repository } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: null,
			patch: { destinationUrl: "http://127.0.0.1/admin" },
		});

		expect(result).toEqual({ ok: false, code: "unsafe_url" });
	});

	it("UpdateLinkUseCase updates title and status and writes audit entries", async () => {
		const { repository, updates, auditLogs } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: "key_1",
			patch: { title: "Updated title", status: "disabled" },
		});

		expect(result.ok).toBe(true);
		expect(updates).toHaveLength(1);
		expect(updates[0]).toMatchObject({
			id: "link_1",
			userId: "user_1",
			title: "Updated title",
			status: "disabled",
		});
		expect(updates[0]?.updatedAt).toBeInstanceOf(Date);
		expect(auditLogs).toHaveLength(2);
		expect(auditLogs).toEqual([
			expect.objectContaining({
				linkId: "link_1",
				userId: "user_1",
				actorApiKeyId: "key_1",
				action: "title_changed",
				previousValue: "Original title",
				newValue: "Updated title",
			}),
			expect.objectContaining({
				linkId: "link_1",
				userId: "user_1",
				actorApiKeyId: "key_1",
				action: "link_disabled",
				previousValue: "active",
				newValue: "disabled",
			}),
		]);
	});

	it("UpdateLinkUseCase audits normalized destination URL changes", async () => {
		const { repository, updates, auditLogs } = createRepository();
		const useCase = new UpdateLinkUseCase({
			linksRepository: repository,
			domainBlocklistRepository: { load: async () => [] },
		});

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: "key_1",
			patch: { destinationUrl: "https://Example.COM:443/next" },
		});

		expect(result.ok).toBe(true);
		expect(updates[0]).toMatchObject({
			destinationUrl: "https://example.com/next",
		});
		expect(auditLogs).toEqual([
			expect.objectContaining({
				action: "destination_url_changed",
				previousValue: "https://example.com/start",
				newValue: "https://example.com/next",
			}),
		]);
	});

	it("DeleteLinkUseCase soft-deletes link and writes audit entry", async () => {
		const { repository, softDeletes, auditLogs } = createRepository();
		const useCase = new DeleteLinkUseCase({ linksRepository: repository });

		const result = await useCase.execute({
			id: "link_1",
			ownerUserId: "user_1",
			actorApiKeyId: "key_1",
		});

		expect(result.ok).toBe(true);
		expect(softDeletes).toHaveLength(1);
		expect(softDeletes[0]).toMatchObject({ id: "link_1", userId: "user_1" });
		expect(softDeletes[0]?.deletedAt).toBeInstanceOf(Date);
		expect(auditLogs).toEqual([
			expect.objectContaining({
				linkId: "link_1",
				userId: "user_1",
				actorApiKeyId: "key_1",
				action: "link_deleted",
				previousValue: "active",
				newValue: "deleted",
			}),
		]);
	});
});
