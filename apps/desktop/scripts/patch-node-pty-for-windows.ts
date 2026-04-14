/**
 * Patch node-pty for Windows compilation with VS2022 Community.
 *
 * This script:
 * 1. Removes SpectreMitigation from binding.gyp (requires Spectre libs)
 * 2. Removes SpectreMitigation from winpty.gyp
 * 3. Fixes winpty.gyp include_dirs and commit hash resolution
 * 4. Pre-generates GenVersion.h to bypass broken batch file paths
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

function findNodePtyDir(): string {
	const baseDir = dirname(import.meta.dirname);

	// Standard install location
	const standardPath = join(baseDir, "node_modules", "node-pty");
	if (existsSync(join(standardPath, "package.json"))) {
		return standardPath;
	}

	// Bun isolated install location: search for any node-pty@ version
	const bunDir = join(baseDir, "node_modules", ".bun");
	if (existsSync(bunDir)) {
		for (const entry of readdirSync(bunDir)) {
			if (entry.startsWith("node-pty@")) {
				const candidate = join(bunDir, entry, "node_modules", "node-pty");
				if (existsSync(join(candidate, "package.json"))) {
					return candidate;
				}
			}
		}
	}

	throw new Error("node-pty package not found");
}

function patchBindingGyp(nodePtyDir: string): void {
	const path = join(nodePtyDir, "binding.gyp");
	if (!existsSync(path)) return;

	let content = readFileSync(path, "utf8");
	const original = content;

	// Remove SpectreMitigation blocks
	content = content.replace(
		/'msvs_configuration_attributes':\s*\{\s*SpectreMitigation:\s*'Spectre'\s*\},?/g,
		"",
	);

	if (content !== original) {
		writeFileSync(path, content);
		console.log("[patch-node-pty] Removed SpectreMitigation from binding.gyp");
	}
}

function patchWinptyGyp(nodePtyDir: string): void {
	const path = join(nodePtyDir, "deps", "winpty", "src", "winpty.gyp");
	if (!existsSync(path)) return;

	let content = readFileSync(path, "utf8");
	const original = content;

	// Remove SpectreMitigation blocks from VCCLCompilerTool AdditionalOptions
	content = content.replace(
		/'AdditionalOptions':\s*\[[^\]]*'\/ZH:SHA_256'[^\]]*\],?/g,
		"'AdditionalOptions': [],",
	);

	// Fix WINPTY_COMMIT_HASH to avoid GetCommitHash.bat
	content = content.replace(
		/'WINPTY_COMMIT_HASH%':\s*'<!\(cmd \/c "git rev-parse HEAD 2>NUL \|\| echo none"\)'/,
		"'WINPTY_COMMIT_HASH%': '<!(node -p \"\"none\"\")'",
	);

	// Fix include_dirs to use relative 'gen' instead of wrong absolute path
	content = content.replace(
		/'include_dirs':\s*\[[\s\S]*?# Add the 'src\/gen' directory[\s\S]*?\],/,
		"'include_dirs': [\n                'gen',\n            ],",
	);

	if (content !== original) {
		writeFileSync(path, content);
		console.log("[patch-node-pty] Patched winpty.gyp");
	}
}

function ensureGenVersionHeader(nodePtyDir: string): void {
	const genDir = join(nodePtyDir, "deps", "winpty", "src", "gen");
	const path = join(genDir, "GenVersion.h");
	if (existsSync(path)) return;

	mkdirSync(genDir, { recursive: true });
	const header = `// AUTO-GENERATED
const char GenVersion_Version[] = "0.4.4-dev";
const char GenVersion_Commit[] = "none";
`;
	writeFileSync(path, header);
	console.log("[patch-node-pty] Created GenVersion.h");
}

function main(): void {
	if (process.platform !== "win32") {
		console.log("[patch-node-pty] Skipping on non-Windows platform");
		return;
	}

	const nodePtyDir = findNodePtyDir();
	console.log(`[patch-node-pty] Found node-pty at ${nodePtyDir}`);

	patchBindingGyp(nodePtyDir);
	patchWinptyGyp(nodePtyDir);
	ensureGenVersionHeader(nodePtyDir);

	console.log("[patch-node-pty] Done");
}

main();
