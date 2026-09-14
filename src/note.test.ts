import test from "node:test";
import assert from "node:assert/strict";
import { capNodeWidths } from "./mindmap-layout.ts";
import { buildFileName, buildNoteMarkdown, demoteMarkdownHeadings, sanitizeTitle } from "./note.ts";
import { formatCueTime, parseTranscriptCues } from "./transcript.ts";

test("sanitizeTitle strips windows-illegal characters and truncates", () => {
	assert.equal(sanitizeTitle("a/b:c"), "abc");
	assert.equal(sanitizeTitle("x".repeat(80)).length, 60);
});

test("buildFileName uses sanitized title without date", () => {
	assert.equal(buildFileName("2026-09-11T12:00:00", "a/b:c"), "abc.md");
});

test("omits empty sections", () => {
	const md = buildNoteMarkdown({
		id: "1",
		title: "T",
		source: "bilibili",
		sourceUrl: "https://b23.tv/x",
		knowledgeDoc: "# k",
		cleanedText: "",
		rawTranscript: null,
		mindMapMarkdown: "- a",
	});
	assert.doesNotMatch(md, /litesight_task_id/);
	assert.doesNotMatch(md, /^# T$/m);
	assert.match(md, /^# 知识笔记$/m);
	assert.match(md, /^# 脑图$/m);
	assert.match(md, /^## k$/m);
	assert.doesNotMatch(md, /^# k$/m);
	assert.doesNotMatch(md, /## 清洗文案/);
	assert.doesNotMatch(md, /## 纯净文案/);
	assert.doesNotMatch(md, /## 时间戳文案/);
	assert.match(md, /> \[!info\] 来源/);
	assert.match(md, /原视频：\[T\]\(https:\/\/b23\.tv\/x\)/);
	assert.match(md, /- \[脑图\]\(#脑图\)/);
	assert.match(md, /- \[知识笔记\]\(#知识笔记\)/);
	assert.match(md, /```litesight-mindmap\n- a\n```/);
	assert.ok(md.indexOf("# 脑图") < md.indexOf("# 知识笔记"));
});

test("section order is mindmap, notes, transcript, cleaned text", () => {
	const md = buildNoteMarkdown({
		id: "1",
		title: "T",
		knowledgeDoc: "k",
		cleanedText: "c",
		rawTranscript: "t",
		mindMapMarkdown: "- a",
	});
	const mind = md.indexOf("# 脑图");
	const notes = md.indexOf("# 知识笔记");
	const transcript = md.indexOf("# 时间戳文案");
	const cleaned = md.indexOf("# 纯净文案");
	assert.ok(mind < notes && notes < transcript && transcript < cleaned);
});

test("mindmap keeps original headings inside code fence", () => {
	const md = buildNoteMarkdown({
		id: "1",
		title: "T",
		mindMapMarkdown: "# root\n## child",
	});
	assert.match(md, /```litesight-mindmap\n# root\n## child\n```/);
	assert.doesNotMatch(md, /### root/);
});

test("demoteMarkdownHeadings skips fenced code", () => {
	const out = demoteMarkdownHeadings("# a\n```\n# keep\n```\n## b", 2);
	assert.match(out, /^### a$/m);
	assert.match(out, /^# keep$/m);
	assert.match(out, /^#### b$/m);
});

test("capNodeWidths clamps oversized measured nodes", () => {
	const root = {
		state: { size: [1200, 20] },
		children: [{ state: { size: [40, 18] }, children: [] }],
	};
	capNodeWidths(root);
	assert.equal(root.state.size[0], 180);
	assert.equal(root.children[0].state.size[0], 40);
});

test("parseTranscriptCues splits tencent stamps into timed lines", () => {
	const cues = parseTranscriptCues("[24:7.880,24:9.520]  是嫌少了。[24:9.980,25:10.460]  那其实呢");
	assert.equal(cues.length, 2);
	assert.equal(cues[0].time, "24:07");
	assert.equal(cues[0].text, "是嫌少了。");
	assert.equal(cues[1].time, "24:09");
});

test("formatCueTime pads and promotes hours", () => {
	assert.equal(formatCueTime("5", "3.2"), "05:03");
	assert.equal(formatCueTime("90", "7.88"), "1:30:07");
});

test("transcript section uses cue fence", () => {
	const md = buildNoteMarkdown({
		id: "1",
		title: "T",
		rawTranscript: "[0:1.000,0:2.000] hello",
	});
	assert.match(md, /```litesight-cues\n00:01 hello\n```/);
});

test("same-name conflict appends short id of incoming task", () => {
	assert.equal(
		buildFileName("2026-09-11", "T", { conflict: true, taskId: "123456789" }),
		"T-456789.md",
	);
});
