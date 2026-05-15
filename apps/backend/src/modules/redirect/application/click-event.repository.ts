export interface ClickEventCreateInput {
  linkId: string;
  clickedAt: Date;
  referrerDomain: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  isBot: boolean;
}

export interface ClickEventRepository {
  create(input: ClickEventCreateInput): Promise<void>;
}
