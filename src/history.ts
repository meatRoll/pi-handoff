/**
 * Branch selection for handoff.
 *
 * These helpers are kept free of runtime pi imports so they can be unit tested
 * without booting a session. They reproduce pi's own message view of a branch:
 * the most recent compaction summary replaces everything before the entry it
 * keeps (`firstKeptEntryId`), and entries after the compaction are appended.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

/** Convert a session entry into an LLM message, if it carries conversation content. */
export function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
	if (entry.type === "message") {
		return entry.message;
	}
	if (entry.type === "compaction") {
		return {
			role: "compactionSummary",
			summary: entry.summary,
			tokensBefore: entry.tokensBefore,
			timestamp: new Date(entry.timestamp).getTime(),
		};
	}
	return undefined;
}

/**
 * Collect the messages a fresh thread should inherit from `branch`.
 *
 * When the branch was compacted, only the latest compaction summary plus the
 * entries it kept and everything after it are returned, so the handoff prompt
 * is not dominated by history the user already summarized away.
 */
export function getHandoffMessages(branch: SessionEntry[]): AgentMessage[] {
	let compactionIndex = -1;
	for (let i = branch.length - 1; i >= 0; i--) {
		if (branch[i].type === "compaction") {
			compactionIndex = i;
			break;
		}
	}
	if (compactionIndex < 0) {
		return branch.map(entryToMessage).filter((message) => message !== undefined);
	}

	const compaction = branch[compactionIndex];
	const firstKeptIndex =
		compaction.type === "compaction" ? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId) : -1;
	const compactedBranch = [
		compaction,
		...(firstKeptIndex >= 0 ? branch.slice(firstKeptIndex, compactionIndex) : []),
		...branch.slice(compactionIndex + 1),
	];
	return compactedBranch.map(entryToMessage).filter((message) => message !== undefined);
}
