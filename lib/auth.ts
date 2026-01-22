import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import { isSignupEmailAllowed } from "@/lib/signup-domain";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "sqlite",
	}),
	emailAndPassword: {
		enabled: true,
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					if (!isSignupEmailAllowed(user.email)) {
						throw new APIError("BAD_REQUEST", {
							message: "Email domain is not allowed for sign up.",
						});
					}
				},
			},
		},
	},
	plugins: [nextCookies()],
});
