import { App, TFile, TFolder } from "obsidian";

const COMMENT_ID = /<!--\s*litesight_task_id:\s*([^>\s]+)\s*-->/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const YAML_ID = /(?:^|\n)litesight_task_id:\s*"?([^"\n\r]+)"?/;

export function parseTaskIdFromMarkdown(content: string): string | null {
	const comment = content.match(COMMENT_ID);
	if (comment?.[1]) {
		return comment[1].trim();
	}
	const matter = content.match(FRONTMATTER);
	if (!matter) {
		return null;
	}
	const match = matter[1].match(YAML_ID);
	if (!match) {
		return null;
	}
	const id = match[1].trim();
	return id.length > 0 ? id : null;
}

export async function scanImportedTaskIds(app: App, folder: string): Promise<Map<string, string>> {
	const imported = new Map<string, string>();
	const root = app.vault.getAbstractFileByPath(folder);
	if (!(root instanceof TFolder)) {
		return imported;
	}
	for (const child of root.children) {
		if (!(child instanceof TFile) || child.extension !== "md") {
			continue;
		}
		const content = await app.vault.cachedRead(child);
		const id = parseTaskIdFromMarkdown(content);
		if (id) {
			imported.set(id, child.path);
		}
	}
	return imported;
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
	if (!folder) {
		return;
	}
	const existing = app.vault.getAbstractFileByPath(folder);
	if (!existing) {
		await app.vault.createFolder(folder);
	}
}
