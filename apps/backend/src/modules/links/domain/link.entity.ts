export type LinkEffectiveState =
  | "deleted"
  | "flagged"
  | "disabled"
  | "expired"
  | "active";

export interface LinkProps {
  id: string;
  userId: string;
  createdViaApiKeyId: string | null;
  code: string;
  destinationUrl: string;
  title: string | null;
  status: string;
  expiresAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Link {
  readonly id: string;
  readonly userId: string;
  readonly createdViaApiKeyId: string | null;
  readonly code: string;
  readonly destinationUrl: string;
  readonly title: string | null;
  readonly status: string;
  readonly expiresAt: Date | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(data: LinkProps) {
    this.id = data.id;
    this.userId = data.userId;
    this.createdViaApiKeyId = data.createdViaApiKeyId;
    this.code = data.code;
    this.destinationUrl = data.destinationUrl;
    this.title = data.title;
    this.status = data.status;
    this.expiresAt = data.expiresAt;
    this.deletedAt = data.deletedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static create(data: LinkProps): Link {
    return new Link(data);
  }

  stateAt(now: Date): LinkEffectiveState {
    if (this.deletedAt || this.status === "deleted") {
      return "deleted";
    }

    if (this.status === "flagged") {
      return "flagged";
    }

    if (this.status === "disabled") {
      return "disabled";
    }

    if (this.expiresAt && this.expiresAt <= now) {
      return "expired";
    }

    return "active";
  }

  canRedirect(now: Date): boolean {
    return this.stateAt(now) === "active";
  }
}
