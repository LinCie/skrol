import { ClickEvent } from "../domain/click-event.entity";

export interface CreateClickEventInput {
	linkId: string;
	clickedAt: Date;
	referrerDomain: string | null;
	country: string | null;
	browser: string | null;
	os: string | null;
	device: string | null;
	isBot: boolean;
}

export interface AnalyticsRepository {
	createClickEvent(input: CreateClickEventInput): Promise<ClickEvent>;
}
