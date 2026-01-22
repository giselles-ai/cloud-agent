import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function Home() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (session) {
		redirect("/app");
	}

	return (
		<main className="min-h-screen bg-slate-950 text-slate-100">
			<div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
				<h1 className="text-3xl font-semibold">Cloud Agent</h1>
				<p className="mt-2 text-sm text-slate-400">
					An MVP for chatting with agents running in Vercel Sandbox.
				</p>
				<div className="mt-6 flex gap-3">
					<a
						href="/sign-in"
						className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
					>
						Sign in
					</a>
					<a
						href="/sign-up"
						className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-100"
					>
						Sign up
					</a>
				</div>
			</div>
		</main>
	);
}
