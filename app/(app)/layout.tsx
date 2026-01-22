import { headers } from "next/headers";
import { redirect } from "next/navigation";

import SignOutButton from "@/app/(app)/components/SignOutButton";
import { auth } from "@/lib/auth";

export default async function AppLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) {
		redirect("/sign-in");
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			<header className="border-b border-slate-800 px-6 py-4">
				<div className="mx-auto flex max-w-6xl items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold">Cloud Agent</h1>
						<p className="text-xs text-slate-400">
							Signed in as {session.user.email}
						</p>
					</div>
					<SignOutButton />
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
		</div>
	);
}
