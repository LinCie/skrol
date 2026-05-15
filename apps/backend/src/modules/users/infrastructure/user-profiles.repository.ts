import {
	getDatabase,
	type PostgresClient,
} from "@/shared/infrastructure/database";

export type EnsureUserProfile = (userId: string) => Promise<void>;

export class UserProfilesRepository {
	constructor(private readonly db: PostgresClient = getDatabase()) {}

	async ensure(userId: string): Promise<void> {
		await this.db
			.insertInto("userProfiles")
			.values({ userId, role: "user" })
			.onConflict((oc) => oc.column("userId").doNothing())
			.execute();
	}
}
