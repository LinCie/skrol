export type ClickEventType = {
	id: string;
	linkId: string;
	isBot: boolean;
	browser: string | null;
	country: string | null;
	device: string | null;
	os: string | null;
	referrerDomain: string | null;
	clickedAt: Date;
};

export class ClickEvent {
	readonly id: string;
	linkId: string;
	isBot: boolean;
	browser: string | null;
	country: string | null;
	device: string | null;
	os: string | null;
	referrerDomain: string | null;
	clickedAt: Date;

	constructor(data: ClickEventType) {
		this.id = data.id;
		this.linkId = data.linkId;
		this.isBot = data.isBot;
		this.browser = data.browser;
		this.country = data.country;
		this.device = data.device;
		this.os = data.os;
		this.referrerDomain = data.referrerDomain;
		this.clickedAt = data.clickedAt;
	}

	static create(data: ClickEventType): ClickEvent {
		return new ClickEvent(data);
	}
}
