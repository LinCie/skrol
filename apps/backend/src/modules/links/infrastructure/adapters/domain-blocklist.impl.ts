import type { DomainBlocklistPort } from "../../application/domain-blocklist.port";
import type { DomainBlocklistEntry } from "@/modules/links/domain/domain-blocklist-policy";
import { getDatabase, PostgresClient } from "@/shared/infrastructure/database";

export class DomainBlocklistImpl implements DomainBlocklistPort {
	constructor(private readonly db: PostgresClient = getDatabase()) {}

	async load(): Promise<Array<DomainBlocklistEntry>> {
		return this.db
			.selectFrom("domainBlocklist")
			.select(["domain", "disabledAt"])
			.execute();
	}
}
