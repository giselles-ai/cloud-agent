import { Sandbox } from "@vercel/sandbox";

export async function createSandbox() {
	return Sandbox.create({ runtime: "node24" });
}

export async function getSandbox(sandboxId: string) {
	try {
		return await Sandbox.get({ sandboxId });
	} catch {
		return null;
	}
}

export async function stopSandbox(sandboxId: string) {
	const sandbox = await getSandbox(sandboxId);
	if (!sandbox) {
		return false;
	}
	await sandbox.stop();
	return true;
}
