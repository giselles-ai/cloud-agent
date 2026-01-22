import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const ignoreDirs = new Set([".git", ".next", "node_modules", "opensrc"]);

const allowHiddenDirs = new Set([".workspace-fs"]);

const ignoreFiles = new Set(["bun.lockb"]);

const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u;

type Match = {
	file: string;
	line: number;
	text: string;
};

async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		if (entry.name.startsWith(".") && !allowHiddenDirs.has(entry.name)) {
			continue;
		}
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (ignoreDirs.has(entry.name)) {
				continue;
			}
			files.push(...(await walk(fullPath)));
		} else if (entry.isFile()) {
			if (ignoreFiles.has(entry.name)) {
				continue;
			}
			files.push(fullPath);
		}
	}

	return files;
}

async function findJapaneseInFile(filePath: string): Promise<Match[]> {
	const fileStat = await stat(filePath);
	if (!fileStat.isFile()) {
		return [];
	}

	const content = await readFile(filePath, "utf8");
	const lines = content.split(/\r?\n/);
	const matches: Match[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (japaneseRegex.test(line)) {
			matches.push({
				file: filePath,
				line: index + 1,
				text: line.trim(),
			});
		}
	}

	return matches;
}

async function main() {
	const files = await walk(root);
	const matches: Match[] = [];

	for (const file of files) {
		matches.push(...(await findJapaneseInFile(file)));
	}

	if (matches.length > 0) {
		console.error("Japanese text found:");
		for (const match of matches) {
			const relative = path.relative(root, match.file);
			console.error(`${relative}:${match.line}: ${match.text}`);
		}
		process.exit(1);
	}

	console.log("No Japanese text found.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
