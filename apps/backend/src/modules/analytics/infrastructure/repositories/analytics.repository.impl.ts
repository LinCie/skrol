import { getDatabase, PostgresClient } from "@/shared/infrastructure/database";
import {
	AnalyticsRepository,
	CreateClickEventInput,
} from "../../application/analytics.repository";
import { ClickEvent } from "../../domain/click-event.entity";

export class AnalyticsRepositoryImpl implements AnalyticsRepository {
	constructor(private readonly db: PostgresClient = getDatabase()) {}

	async createClickEvent(input: CreateClickEventInput): Promise<ClickEvent> {
		const returning = await this.db
			.insertInto("clickEvents")
			.values(input)
			.returningAll()
			.executeTakeFirstOrThrow();

		return ClickEvent.create(returning);
	}
}
