import { AnalyticsRepositoryImpl } from "@/modules/analytics/infrastructure/repositories/analytics.repository.impl";
import type { AnalyticsRepository } from "@/modules/analytics/application/analytics.repository";
import type {
  ClickEventCreateInput,
  ClickEventRepository,
} from "../../application/click-event.repository";

export class ClickEventRepositoryImpl implements ClickEventRepository {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository = new AnalyticsRepositoryImpl(),
  ) {}

  async create(input: ClickEventCreateInput): Promise<void> {
    await this.analyticsRepository.createClickEvent(input);
  }
}
