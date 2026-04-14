import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { SUPERSET_DIR_NAME } from "shared/constants";

const SUPERSET_HOME_DIR = join(homedir(), SUPERSET_DIR_NAME);

export const IS_NAMED_PIPE = process.platform === "win32";

export function getTerminalHostSocketPath(): string {
	if (IS_NAMED_PIPE) {
		// Use a named pipe on Windows. Hash the home dir for a unique, safe name.
		const hash = createHash("md5")
			.update(SUPERSET_HOME_DIR)
			.digest("hex")
			.slice(0, 16);
		return `\\\\?\\pipe\\superset-terminal-host-${hash}`;
	}
	return join(SUPERSET_HOME_DIR, "terminal-host.sock");
}
