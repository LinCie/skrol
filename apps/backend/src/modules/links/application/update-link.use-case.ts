import {
	domainMatchesBlocklist,
	type DomainBlocklistEntry,
} from "@/modules/links/domain/domain-blocklist-policy";
import { validateDestinationUrl } from "@/modules/links/domain/url-safety-policy";
import type { Link } from "@/modules/links/domain/link.entity";
import type { DomainBlocklistPort } from "./domain-blocklist.port";
import type {
	CreateLinkAuditLogInput,
	LinksRepository,
	UpdateLinkRepositoryInput,
} from "./links.repository";

export interface UpdateLinkInput {
	id: string;
	ownerUserId: string;
	actorApiKeyId?: string | null;
	patch: {
		title?: string | null;
		destinationUrl?: string;
		expiresAt?: Date | null;
		status?: string;
	};
}

export type UpdateLinkErrorCode =
	| "not_found"
	| "invalid_url"
	| "unsafe_url"
	| "validation_error";

export type UpdateLinkResult =
	| { ok: true; link: Link }
	| { ok: false; code: UpdateLinkErrorCode };

export interface UpdateLinkUseCaseDependencies {
	linksRepository: LinksRepository;
	domainBlocklistRepository: DomainBlocklistPort;
}

export class UpdateLinkUseCase {
	constructor(private readonly deps: UpdateLinkUseCaseDependencies) {}

	async execute(input: UpdateLinkInput): Promise<UpdateLinkResult> {
		if (!hasRecognizedUpdateField(input.patch)) {
			return { ok: false, code: "validation_error" };
		}

		const existing = await this.deps.linksRepository.findByIdForOwner(
			input.id,
			input.ownerUserId,
		);
		if (!existing) {
			return { ok: false, code: "not_found" };
		}

		const patch: UpdateLinkRepositoryInput = {
			id: input.id,
			userId: input.ownerUserId,
			updatedAt: new Date(),
		};

		if ("title" in input.patch) {
			if (input.patch.title === undefined) {
				return { ok: false, code: "validation_error" };
			}

			patch.title = input.patch.title ?? null;
		}

		if ("expiresAt" in input.patch) {
			if (input.patch.expiresAt === undefined) {
				return { ok: false, code: "validation_error" };
			}

			patch.expiresAt = input.patch.expiresAt ?? null;
		}

		if ("status" in input.patch) {
			const status = input.patch.status;
			if (status !== "active" && status !== "disabled") {
				return { ok: false, code: "validation_error" };
			}
			if (existing.status !== "active" && existing.status !== "disabled") {
				return { ok: false, code: "validation_error" };
			}

			patch.status = status;
		}

		if ("destinationUrl" in input.patch) {
			const destinationUrl = input.patch.destinationUrl;
			if (destinationUrl === undefined) {
				return { ok: false, code: "validation_error" };
			}

			const destinationResult = validateDestinationUrl(destinationUrl);
			if (!destinationResult.ok) {
				return { ok: false, code: destinationResult.code };
			}

			const blocklist = await this.deps.domainBlocklistRepository.load();
			if (
				domainMatchesBlocklist(destinationResult.destination.hostname, blocklist)
			) {
				return { ok: false, code: "unsafe_url" };
			}

			patch.destinationUrl = destinationResult.destination.toString();
		}

		const link = await this.deps.linksRepository.updateLinkForOwner(patch);
		if (!link) {
			return { ok: false, code: "not_found" };
		}

		for (const auditLog of this.buildAuditLogs(input, existing, patch)) {
			await this.deps.linksRepository.createAuditLog(auditLog);
		}

		return { ok: true, link };
	}

	private buildAuditLogs(
		input: UpdateLinkInput,
		existing: Link,
		patch: UpdateLinkRepositoryInput,
	): CreateLinkAuditLogInput[] {
		const base = {
			linkId: input.id,
			userId: input.ownerUserId,
			actorApiKeyId: input.actorApiKeyId ?? null,
			createdAt: patch.updatedAt,
		};
		const logs: CreateLinkAuditLogInput[] = [];

		if ("title" in patch && patch.title !== existing.title) {
			logs.push({
				...base,
				action: "title_changed",
				previousValue: existing.title,
				newValue: patch.title,
			});
		}

		if ("destinationUrl" in patch && patch.destinationUrl !== existing.destinationUrl) {
			logs.push({
				...base,
				action: "destination_url_changed",
				previousValue: existing.destinationUrl,
				newValue: patch.destinationUrl,
			});
		}

		if ("expiresAt" in patch) {
			const nextExpiresAt = patch.expiresAt;
			if (nextExpiresAt?.getTime() !== existing.expiresAt?.getTime()) {
				logs.push({
					...base,
					action: "expiration_changed",
					previousValue: existing.expiresAt,
					newValue: nextExpiresAt,
				});
			}
		}

		if ("status" in patch && patch.status !== existing.status) {
			logs.push({
				...base,
				action:
					patch.status === "disabled" ? "link_disabled" : "link_reenabled",
				previousValue: existing.status,
				newValue: patch.status,
			});
		}

		return logs;
	}
}

export type { DomainBlocklistEntry };

function hasRecognizedUpdateField(input: UpdateLinkInput["patch"]): boolean {
	return (
		"title" in input ||
		"destinationUrl" in input ||
		"expiresAt" in input ||
		"status" in input
	);
}
