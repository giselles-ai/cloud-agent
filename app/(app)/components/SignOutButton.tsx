"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const handleSignOut = async () => {
		setIsLoading(true);
		await authClient.signOut({});
		router.push("/sign-in");
	};

	return (
		<button
			type="button"
			onClick={handleSignOut}
			disabled={isLoading}
			className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200 disabled:opacity-70"
		>
			{isLoading ? "Signing out..." : "Sign out"}
		</button>
	);
}
