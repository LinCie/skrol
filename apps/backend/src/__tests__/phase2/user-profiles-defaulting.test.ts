import { describe, expect, it } from "bun:test";
import { BetterAuthSessionService } from "@/modules/auth/infrastructure/auth-session.service.impl";
import { createBetterAuthConfig } from "@/modules/auth/infrastructure/better-auth.server";
import { UserProfilesRepository } from "@/modules/users/infrastructure/user-profiles.repository";

type StoredProfile = {
	userId: string;
	role: string;
	createdAt: Date;
	updatedAt: Date;
};

class InMemoryUserProfilesDb {
	readonly profiles = new Map<string, StoredProfile>();
	insertAttempts = 0;

	insertInto(tableName: "userProfiles") {
		expect(tableName).toBe("userProfiles");

		return {
			values: (values: { userId: string; role?: string }) => ({
				onConflict: (buildConflict: (oc: unknown) => unknown) => {
					buildConflict({ column: () => ({ doNothing: () => undefined }) });

					return {
						execute: async () => {
							this.insert(values);
							return [];
						},
						returningAll: () => ({
							executeTakeFirst: async () => this.insert(values),
							executeTakeFirstOrThrow: async () => {
								const row = this.insert(values);
								if (!row) {
									throw new Error("no result");
								}

								return row;
							},
						}),
					};
				},
			}),
		};
	}

	private insert(values: { userId: string; role?: string }) {
		this.insertAttempts += 1;

		const existing = this.profiles.get(values.userId);
		if (existing) {
			return undefined;
		}

		const now = new Date("2026-05-15T00:00:00.000Z");
		const profile = {
			userId: values.userId,
			role: values.role ?? "user",
			createdAt: now,
			updatedAt: now,
		};
		this.profiles.set(values.userId, profile);
		return profile;
	}
}

describe("user_profiles defaulting", () => {
	it("signup hook ensures a profile exists with the default user role", async () => {
		const db = new InMemoryUserProfilesDb();
		const repository = new UserProfilesRepository(db as never);
		const config = createBetterAuthConfig({
			database: {} as never,
			ensureUserProfile: (userId) => repository.ensure(userId),
		});

		await config.databaseHooks?.user?.create?.after?.({
			id: "user_signup",
		} as never);

		expect(db.profiles.get("user_signup")?.role).toBe("user");
	});

	it("session resolution lazily creates a missing profile", async () => {
		const db = new InMemoryUserProfilesDb();
		const repository = new UserProfilesRepository(db as never);
		const service = new BetterAuthSessionService(
			async () => ({
				session: { id: "session_123" },
				user: { id: "user_lazy" },
			}),
			(userId) => repository.ensure(userId),
		);

		const principal = await service.resolveFromRequest(
			new Request("http://localhost/private"),
		);

		expect(principal).toEqual({
			userId: "user_lazy",
			sessionId: "session_123",
			authSource: "session",
		});
		expect(db.profiles.get("user_lazy")?.role).toBe("user");
	});

	it("repeated ensure and lazy backfill are idempotent", async () => {
		const db = new InMemoryUserProfilesDb();
		const repository = new UserProfilesRepository(db as never);
		const service = new BetterAuthSessionService(
			async () => ({
				session: { id: "session_123" },
				user: { id: "user_repeat" },
			}),
			(userId) => repository.ensure(userId),
		);

		await repository.ensure("user_repeat");
		await repository.ensure("user_repeat");
		await service.resolveFromRequest(new Request("http://localhost/private"));

		expect(db.profiles.get("user_repeat")?.role).toBe("user");
		expect(db.profiles).toHaveLength(1);
	});

	it("does not overwrite an existing admin role", async () => {
		const db = new InMemoryUserProfilesDb();
		db.profiles.set("admin_1", {
			userId: "admin_1",
			role: "admin",
			createdAt: new Date("2026-05-15T00:00:00.000Z"),
			updatedAt: new Date("2026-05-15T00:00:00.000Z"),
		});
		const repository = new UserProfilesRepository(db as never);

		await repository.ensure("admin_1");

		expect(db.profiles.get("admin_1")?.role).toBe("admin");
	});
});
