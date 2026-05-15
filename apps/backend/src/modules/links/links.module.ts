import { CreateLinkUseCase } from "./application/create-link.use-case";
import { GetLinkDetailUseCase } from "./application/get-link-detail.use-case";
import { ListLinksUseCase } from "./application/list-links.use-case";
import { CodeGeneratorImpl } from "./infrastructure/adapters/code-generator.impl";
import { DomainBlocklistImpl } from "./infrastructure/adapters/domain-blocklist.impl";
import { LinksRepositoryImpl } from "./infrastructure/repositories/links.repository.impl";
import type { LinksRepository } from "./application/links.repository";

export class LinksModule {
  readonly repository: LinksRepository;
  readonly createLinkUseCase: CreateLinkUseCase;
  readonly listLinksUseCase: ListLinksUseCase;
  readonly getLinkDetailUseCase: GetLinkDetailUseCase;

  constructor(repository: LinksRepository = new LinksRepositoryImpl()) {
    this.repository = repository;
    this.createLinkUseCase = new CreateLinkUseCase({
      repository: this.repository,
      codeGenerator: new CodeGeneratorImpl(),
      domainBlocklist: new DomainBlocklistImpl(),
    });
    this.listLinksUseCase = new ListLinksUseCase(this.repository);
    this.getLinkDetailUseCase = new GetLinkDetailUseCase(this.repository);
  }
}
