import { formatTranscriptBlock } from "./transcript.ts";

const ILLEGAL = /[\\/:*?"<>|]/g;
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
const TITLE_MAX = 60;

export interface NoteInput {
	id: string;
	title: string;
	source?: string | null;
	sourceUrl?: string | null;
	cover?: string | null;
	mediaUrl?: string | null;
	audioUrl?: string | null;
	knowledgeDoc?: string | null;
	cleanedText?: string | null;
	rawTranscript?: string | null;
	mindMapMarkdown?: string | null;
	createTime?: string | null;
	imported?: string | null;
}

export interface FileNameOptions {
	conflict?: boolean;
	taskId?: string;
}

export function sanitizeTitle(title: string): string {
	const cleaned = (title ?? "").replace(ILLEGAL, "").trim() || "untitled";
	return cleaned.length > TITLE_MAX ? cleaned.slice(0, TITLE_MAX) : cleaned;
}

export function dateFromCreateTime(createTime: string | null | undefined): string {
	if (!createTime) {
		return "1970-01-01";
	}
	const match = String(createTime).match(DATE_PREFIX);
	return match ? match[1] : "1970-01-01";
}

export function shortTaskId(taskId: string): string {
	const id = String(taskId);
	return id.length <= 6 ? id : id.slice(-6);
}

export function buildFileName(createTime: string, title: string, options?: FileNameOptions): string {
	const name = sanitizeTitle(title);
	if (options?.conflict && options.taskId) {
		return `${name}-${shortTaskId(options.taskId)}.md`;
	}
	return `${name}.md`;
}

export function buildNoteMarkdown(input: NoteInput): string {
	const title = input.title || "untitled";
	const lines: string[] = [];
	pushSourceCallout(lines, title, input);
	const sections: Array<[string, string | null | undefined]> = [
		["脑图", input.mindMapMarkdown],
		["知识笔记", input.knowledgeDoc],
		["时间戳文案", input.rawTranscript],
		["纯净文案", input.cleanedText],
	];
	const present = sections.filter(([, body]) => hasText(body));
	if (present.length > 0) {
		lines.push("# 目录", "");
		for (const [heading] of present) {
			lines.push(`- [${heading}](#${heading})`);
		}
		lines.push("");
	}
	for (const [heading, body] of present) {
		if (heading === "脑图") {
			pushMindmapSection(lines, body);
		} else if (heading === "时间戳文案") {
			pushTranscriptSection(lines, body);
		} else {
			pushSection(lines, heading, body);
		}
	}
	const text = lines.join("\n");
	return `${text.replace(/[ \t\r\n]+$/u, "")}\n`;
}

function hasText(value: string | null | undefined): value is string {
	return value != null && value.trim().length > 0;
}

function pushSourceCallout(lines: string[], title: string, input: NoteInput): void {
	const meta: string[] = [];
	if (hasText(input.source)) {
		meta.push(`平台：${input.source}`);
	}
	if (hasText(input.sourceUrl)) {
		meta.push(`原视频：[${title}](${input.sourceUrl})`);
	}
	if (meta.length === 0) {
		return;
	}
	lines.push("> [!info] 来源");
	for (const item of meta) {
		lines.push(`> ${item}`);
	}
	lines.push("");
}

function pushSection(lines: string[], heading: string, body: string | null | undefined): void {
	if (!hasText(body)) {
		return;
	}
	lines.push("---", "", `# ${heading}`, "");
	lines.push(demoteMarkdownHeadings(body.trim(), 1), "");
}

function pushTranscriptSection(lines: string[], body: string | null | undefined): void {
	if (!hasText(body)) {
		return;
	}
	const block = formatTranscriptBlock(body);
	const fence = longestFence(block);
	lines.push("---", "", "# 时间戳文案", "");
	lines.push(`${fence}litesight-cues`, block, fence, "");
}

function pushMindmapSection(lines: string[], body: string | null | undefined): void {
	if (!hasText(body)) {
		return;
	}
	const markdown = body.trim();
	const fence = longestFence(markdown);
	lines.push("---", "", "# 脑图", "");
	lines.push(`${fence}litesight-mindmap`, markdown, fence, "");
}

function longestFence(body: string): string {
	let ticks = "```";
	while (body.includes(ticks)) {
		ticks += "`";
	}
	return ticks;
}

export function demoteMarkdownHeadings(markdown: string, levels: number): string {
	if (levels <= 0) {
		return markdown;
	}
	const shift = Math.min(levels, 5);
	let inFence = false;
	const out: string[] = [];
	for (const line of markdown.split("\n")) {
		const fence = line.trimStart().startsWith("```") || line.trimStart().startsWith("~~~");
		if (fence) {
			inFence = !inFence;
			out.push(line);
			continue;
		}
		out.push(inFence ? line : demoteAtxHeading(line, shift));
	}
	return out.join("\n");
}

function demoteAtxHeading(line: string, shift: number): string {
	let i = 0;
	while (i < line.length && i < 3 && line.charAt(i) === " ") {
		i += 1;
	}
	const indent = line.slice(0, i);
	let hashes = 0;
	while (i < line.length && line.charAt(i) === "#") {
		hashes += 1;
		i += 1;
	}
	if (hashes < 1 || hashes > 6) {
		return line;
	}
	const next = line.charAt(i);
	if (next !== " " && next !== "\t") {
		return line;
	}
	return `${indent}${"#".repeat(Math.min(hashes + shift, 6))}${line.slice(i)}`;
}
