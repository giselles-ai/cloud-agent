"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setIsLoading(true);

		const { error: signInError } = await authClient.signIn.email({
			email,
			password,
		});

		if (signInError) {
			setError(signInError.message);
			setIsLoading(false);
			return;
		}

		router.push("/app");
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Sign in</h1>
				<p className="text-sm text-slate-400">
					Email and password でログインします。
				</p>
			</div>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<label className="text-sm text-slate-300" htmlFor="email">
						Email
					</label>
					<input
						id="email"
						type="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
					/>
				</div>
				<div className="space-y-2">
					<label className="text-sm text-slate-300" htmlFor="password">
						Password
					</label>
					<input
						id="password"
						type="password"
						required
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
					/>
				</div>
				{error ? <p className="text-sm text-red-400">{error}</p> : null}
				<button
					type="submit"
					disabled={isLoading}
					className="w-full rounded bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
				>
					{isLoading ? "Signing in..." : "Sign in"}
				</button>
			</form>
			<p className="text-sm text-slate-400">
				まだアカウントがない？{" "}
				<a className="text-indigo-400 hover:underline" href="/sign-up">
					Sign up
				</a>
			</p>
		</div>
	);
}
