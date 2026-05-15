import {
  domainMatchesBlocklist,
  type DomainBlocklistEntry,
} from "@/modules/links/domain/domain-blocklist-policy";
import { validateAlias } from "@/modules/links/domain/alias-policy";
import { validateDestinationUrl } from "@/modules/links/domain/url-safety-policy";
import type { Link } from "@/modules/links/domain/link.entity";
import type { CodeGeneratorPort } from "./code-generator.port";
import type { DomainBlocklistPort } from "./domain-blocklist.port";
import type { LinksRepository } from "./links.repository";

export interface CreateLinkInput {
  ownerUserId: string;
  actorApiKeyId?: string | null;
  destinationUrl: string;
  alias?: string;
  title?: string;
  expiresAt?: Date | null;
}

export type CreateLinkErrorCode =
  | "invalid_url"
  | "unsafe_url"
  | "validation_error"
  | "reserved_alias"
  | "alias_taken";

export type CreateLinkResult =
  | { ok: true; link: Link }
  | { ok: false; code: CreateLinkErrorCode };

export interface CreateLinkUseCaseDependencies {
  repository: LinksRepository;
  codeGenerator: CodeGeneratorPort;
  domainBlocklist: DomainBlocklistPort;
}

export class CreateLinkUseCase {
  constructor(private readonly deps: CreateLinkUseCaseDependencies) {}

  async execute(input: CreateLinkInput): Promise<CreateLinkResult> {
    const destinationResult = validateDestinationUrl(input.destinationUrl);
    if (!destinationResult.ok) {
      return { ok: false, code: destinationResult.code };
    }

    const blocklist = await this.deps.domainBlocklist.load();
    if (
      domainMatchesBlocklist(destinationResult.destination.hostname, blocklist)
    ) {
      return { ok: false, code: "unsafe_url" };
    }

    const codeResult = await this.resolveCode(input.alias);
    if (!codeResult.ok) {
      return codeResult;
    }

    const link = await this.deps.repository.createLink({
      userId: input.ownerUserId,
      createdViaApiKeyId: input.actorApiKeyId ?? null,
      code: codeResult.code,
      destinationUrl: destinationResult.destination.toString(),
      title: input.title ?? null,
      status: "active",
      expiresAt: input.expiresAt ?? null,
      deletedAt: null,
    });

    return { ok: true, link };
  }

  private async resolveCode(
    alias: string | undefined,
  ): Promise<
    { ok: true; code: string } | { ok: false; code: CreateLinkErrorCode }
  > {
    if (alias) {
      const aliasResult = validateAlias(alias);
      if (!aliasResult.ok) {
        return aliasResult;
      }

      if (await this.deps.repository.codeExists(aliasResult.alias)) {
        return { ok: false, code: "alias_taken" };
      }

      return { ok: true, code: aliasResult.alias };
    }

    try {
      const generated = await this.deps.codeGenerator.generate((code) =>
        this.deps.repository.codeExists(code),
      );
      return { ok: true, code: generated };
    } catch {
      return { ok: false, code: "alias_taken" };
    }
  }
}

export type { DomainBlocklistEntry };
