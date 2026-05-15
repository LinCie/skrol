import { CreateLinkUseCase } from "./application/create-link.use-case";
import { CodeGeneratorImpl } from "./infrastructure/adapters/code-generator.impl";
import { DomainBlocklistImpl } from "./infrastructure/adapters/domain-blocklist.impl";
import { LinksRepositoryImpl } from "./infrastructure/repositories/links.repository.impl";
import type { LinksRepository } from "./application/links.repository";

export class LinksModule {
  readonly repository: LinksRepository;
  readonly createLinkUseCase: CreateLinkUseCase;

  constructor(repository: LinksRepository = new LinksRepositoryImpl()) {
    this.repository = repository;
    this.createLinkUseCase = new CreateLinkUseCase({
      repository: this.repository,
      codeGenerator: new CodeGeneratorImpl(),
      domainBlocklist: new DomainBlocklistImpl(),
    });
  }
}
