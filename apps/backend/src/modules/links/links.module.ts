import { CreateLinkUseCase } from "./application/create-link.use-case";
import { DeleteLinkUseCase } from "./application/delete-link.use-case";
import { GetLinkDetailUseCase } from "./application/get-link-detail.use-case";
import { ListLinksUseCase } from "./application/list-links.use-case";
import { UpdateLinkUseCase } from "./application/update-link.use-case";
import { CodeGeneratorImpl } from "./infrastructure/adapters/code-generator.impl";
import { DomainBlocklistImpl } from "./infrastructure/adapters/domain-blocklist.impl";
import { LinksRepositoryImpl } from "./infrastructure/repositories/links.repository.impl";
import type { LinksRepository } from "./application/links.repository";

export class LinksModule {
  readonly repository: LinksRepository;
  readonly createLinkUseCase: CreateLinkUseCase;
  readonly listLinksUseCase: ListLinksUseCase;
  readonly getLinkDetailUseCase: GetLinkDetailUseCase;
  readonly updateLinkUseCase: UpdateLinkUseCase;
  readonly deleteLinkUseCase: DeleteLinkUseCase;

  constructor(repository: LinksRepository = new LinksRepositoryImpl()) {
    const domainBlocklistRepository = new DomainBlocklistImpl();
    this.repository = repository;
    this.createLinkUseCase = new CreateLinkUseCase({
      repository: this.repository,
      codeGenerator: new CodeGeneratorImpl(),
      domainBlocklist: domainBlocklistRepository,
    });
    this.listLinksUseCase = new ListLinksUseCase(this.repository);
    this.getLinkDetailUseCase = new GetLinkDetailUseCase(this.repository);
    this.updateLinkUseCase = new UpdateLinkUseCase({
      linksRepository: this.repository,
      domainBlocklistRepository,
    });
    this.deleteLinkUseCase = new DeleteLinkUseCase({
      linksRepository: this.repository,
    });
  }
}
