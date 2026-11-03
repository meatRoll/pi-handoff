import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { entryToMessage, getHandoffMessages } from "../src/history.ts";

const at = "2026-01-01T00:00:00.000Z";

function message(id: string, role: "user" | "assistant", text: string): SessionEntry {
	const value = role === "user" ? { role, content: text, timestamp: 0 } : { role, content: [{ type: "text", text }] };
	return {
		type: "message",
		id,
		parentId: null,
		timestamp: at,
		message: value as unknown as AgentMessage,
	};
}

function compaction(id: string, summary: string, firstKeptEntryId: string): SessionEntry {
	return {
		type: "compaction",
		id,
		parentId: null,
		timestamp: at,
		summary,
		firstKeptEntryId,
		tokensBefore: 1000,
	};
}

function label(id: string, value: string): SessionEntry {
	return { type: "label", id, parentId: null, timestamp: at, targetId: id, label: value };
}

function summary(summary: string) {
	return { role: "compactionSummary", summary, tokensBefore: 1000, timestamp: Date.parse(at) };
}

test("entryToMessage converts message entries", () => {
	const entry = message("m1", "user", "hello");
	assert.deepEqual(entryToMessage(entry), { role: "user", content: "hello", timestamp: 0 });
});

test("entryToMessage converts compaction entries to a summary message", () => {
	assert.deepEqual(entryToMessage(compaction("c1", "summary text", "m1")), summary("summary text"));
});

test("entryToMessage ignores entries without conversation content", () => {
	assert.equal(entryToMessage(label("l1", "checkpoint")), undefined);
});

test("getHandoffMessages returns every message when the branch was never compacted", () => {
	const branch = [message("m1", "user", "one"), label("l1", "x"), message("m2", "assistant", "two")];
	assert.deepEqual(
		getHandoffMessages(branch).map((entry) => entry.role),
		["user", "assistant"],
	);
});

test("getHandoffMessages keeps the latest summary, its first kept entry and everything after", () => {
	const branch = [
		message("m1", "user", "old"),
		message("m2", "assistant", "old reply"),
		message("m3", "user", "kept"),
		compaction("c1", "the summary", "m3"),
		message("m4", "assistant", "after compaction"),
	];

	assert.deepEqual(getHandoffMessages(branch), [
		summary("the summary"),
		{ role: "user", content: "kept", timestamp: 0 },
		{ role: "assistant", content: [{ type: "text", text: "after compaction" }] },
	]);
});

test("getHandoffMessages falls back to summary and later entries when firstKeptEntryId is missing", () => {
	const branch = [message("m1", "user", "old"), compaction("c1", "summary", "missing-id"), message("m2", "user", "later")];

	assert.deepEqual(getHandoffMessages(branch), [summary("summary"), { role: "user", content: "later", timestamp: 0 }]);
});

test("getHandoffMessages only considers the most recent compaction", () => {
	const branch = [
		message("m1", "user", "ancient"),
		compaction("c1", "first summary", "m2"),
		message("m2", "user", "kept by first"),
		message("m3", "user", "before second"),
		compaction("c2", "second summary", "m3"),
		message("m4", "user", "tail"),
	];

	assert.deepEqual(
		getHandoffMessages(branch).map((entry) =>
			entry.role === "compactionSummary" ? entry.summary : "content" in entry ? entry.content : entry.role,
		),
		["second summary", "before second", "tail"],
	);
});

test("getHandoffMessages returns an empty list for a branch without messages", () => {
	assert.deepEqual(getHandoffMessages([label("l1", "x")]), []);
});
