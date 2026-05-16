import type { Link } from "@/modules/links/domain/link.entity";
import type { LinksRepository } from "./links.repository";

export interface DeleteLinkInput {
	id: string;
	ownerUserId: string;
	actorApiKeyId?: string | null;
}

export type DeleteLinkErrorCode = "not_found";

export type DeleteLinkResult =
	| { ok: true; link: Link }
	| { ok: false; code: DeleteLinkErrorCode };

export interface DeleteLinkUseCaseDependencies {
	linksRepository: LinksRepository;
}

export class DeleteLinkUseCase {
	constructor(private readonly deps: DeleteLinkUseCaseDependencies) {}

	async execute(input: DeleteLinkInput): Promise<DeleteLinkResult> {
		const existing = await this.deps.linksRepository.findByIdForOwner(
			input.id,
			input.ownerUserId,
		);
		if (!existing) {
			return { ok: false, code: "not_found" };
		}

		const deletedAt = new Date();
		const link = await this.deps.linksRepository.softDeleteLinkForOwner({
			id: input.id,
			userId: input.ownerUserId,
			deletedAt,
		});
		if (!link) {
			return { ok: false, code: "not_found" };
		}

		await this.deps.linksRepository.createAuditLog({
			linkId: input.id,
			userId: input.ownerUserId,
			actorApiKeyId: input.actorApiKeyId ?? null,
			action: "link_deleted",
			previousValue: existing.status,
			newValue: "deleted",
			createdAt: deletedAt,
		});

		return { ok: true, link };
	}
}
