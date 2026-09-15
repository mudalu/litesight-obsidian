import { App, Modal, Notice, TFile } from "obsidian";
import type LiteSightPlugin from "./main";
import { LiteSightApi, PluginApiError, type TaskListItem } from "./api";
import { ensureFolder, parseTaskIdFromMarkdown, scanImportedTaskIds } from "./imported";
import { buildFileName, buildNoteMarkdown, dateFromCreateTime } from "./note";
import { extractHttpUrl, isCreditsShortage, isHttpUrl, progressLabel } from "./parse";
import { PRODUCTION_ENDPOINT } from "./settings";

const PAGE_SIZE = 20;
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

export class ImportModal extends Modal {
	private readonly plugin: LiteSightPlugin;
	private tasks: TaskListItem[] = [];
	private selected = new Set<string>();
	private imported = new Map<string, string>();
	private current = 0;
	private total = 0;
	private loading = false;
	private parseBusy = false;
	private pollTimer: number | null = null;
	private pollTaskId: string | null = null;
	private pollStartedAt = 0;
	private pollInFlight = false;
	private summaryEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private moreBtn: HTMLButtonElement | null = null;
	private importBtn: HTMLButtonElement | null = null;
	private urlInput: HTMLInputElement | null = null;
	private parseBtn: HTMLButtonElement | null = null;
	private parseStatusEl: HTMLElement | null = null;

	constructor(plugin: LiteSightPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("litesight-import-modal");
		this.titleEl.setText("轻析：解析与导入");
		this.contentEl.empty();

		const root = this.contentEl.createDiv({ cls: "litesight-import" });

		const parseRow = root.createDiv({ cls: "litesight-parse" });
		this.urlInput = parseRow.createEl("input", {
			type: "text",
			placeholder: "粘贴视频链接或分享文案",
		});
		this.parseBtn = parseRow.createEl("button", { text: "解析", cls: "mod-cta" });
		this.parseBtn.addEventListener("click", () => void this.handleParse());
		this.urlInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				void this.handleParse();
			}
		});
		this.parseStatusEl = root.createDiv({ cls: "litesight-parse-status" });

		const header = root.createDiv({ cls: "litesight-import-header" });
		this.summaryEl = header.createDiv({ cls: "litesight-import-summary" });
		const selectAll = header.createEl("button", { text: "全选未导入", cls: "litesight-import-text-btn" });
		selectAll.addEventListener("click", () => this.selectAllPending());

		this.listEl = root.createDiv({ cls: "litesight-import-list" });

		const footer = root.createDiv({ cls: "litesight-import-footer" });
		const footerLeft = footer.createDiv({ cls: "litesight-import-footer-left" });
		this.moreBtn = footerLeft.createEl("button", { text: "加载更多" });
		this.moreBtn.addEventListener("click", () => void this.loadMore());
		const siteLink = footerLeft.createEl("a", { text: "轻析官网", href: this.plugin.websiteUrl() });
		siteLink.addClass("litesight-external-link");
		siteLink.addEventListener("click", (event) => {
			event.preventDefault();
			window.open(this.plugin.websiteUrl());
		});
		this.importBtn = footer.createEl("button", { text: "导入所选", cls: "mod-cta" });
		this.importBtn.addEventListener("click", () => void this.importSelected());

		this.renderList();
		try {
			this.imported = await scanImportedTaskIds(this.app, this.plugin.settings.folder);
			await this.mergeSavedImports();
			await this.loadMore();
		} catch (error) {
			this.handleError(error);
		}
	}

	onClose(): void {
		this.stopPoll();
		this.contentEl.empty();
		this.modalEl.removeClass("litesight-import-modal");
	}

	private api(): LiteSightApi {
		return new LiteSightApi(PRODUCTION_ENDPOINT, this.plugin.settings.token);
	}

	private pendingIds(): string[] {
		return this.tasks.map((task) => task.id).filter((id) => !this.imported.has(id));
	}

	private selectAllPending(): void {
		for (const id of this.pendingIds()) {
			this.selected.add(id);
		}
		this.renderList();
	}

	private async loadMore(): Promise<void> {
		if (this.loading) {
			return;
		}
		this.loading = true;
		this.syncButtons();
		try {
			const page = await this.api().listTasks(this.current + 1, PAGE_SIZE);
			this.current = page.current;
			this.total = page.total;
			this.tasks.push(...page.records);
			this.renderList();
		} catch (error) {
			this.handleError(error);
		} finally {
			this.loading = false;
			this.syncButtons();
		}
	}

	private async reloadCompletedList(): Promise<void> {
		this.current = 0;
		this.tasks = [];
		await this.loadMore();
	}

	private async handleParse(): Promise<void> {
		if (this.parseBusy) {
			return;
		}
		const raw = this.urlInput?.value ?? "";
		if (!isHttpUrl(raw)) {
			this.setParseStatus("请粘贴视频链接或 App 分享文案", true);
			return;
		}
		const url = extractHttpUrl(raw);
		const confirmed = await confirmAction(this.app, "将提交该链接并扣除积分，是否继续？");
		if (!confirmed) {
			return;
		}
		this.parseBusy = true;
		this.syncButtons();
		this.setParseStatus("正在提交…");
		try {
			const submitted = await this.api().submitTask(url);
			const taskId = submitted.taskId;
			if (!taskId) {
				throw new PluginApiError("未返回任务 ID");
			}
			if (submitted.resultType === "ALREADY_PARSED") {
				if (this.imported.has(taskId)) {
					this.setParseStatus("该任务已导入，已跳过");
					new Notice("该任务已导入");
					this.parseBusy = false;
					this.syncButtons();
					return;
				}
				this.setParseStatus("已解析过，正在写入笔记…");
				await this.finishWrite(taskId);
				this.parseBusy = false;
				this.syncButtons();
				return;
			}
			await this.startPoll(taskId);
		} catch (error) {
			this.parseBusy = false;
			this.syncButtons();
			this.handleParseError(error);
		}
	}

	private async startPoll(taskId: string): Promise<void> {
		this.stopPoll(false);
		this.pollTaskId = taskId;
		this.pollStartedAt = Date.now();
		this.parseBusy = true;
		this.syncButtons();
		await this.tickPoll();
		if (this.pollTaskId) {
			this.pollTimer = window.setInterval(() => void this.tickPoll(), POLL_MS);
		}
	}

	private stopPoll(clearBusy = true): void {
		if (this.pollTimer != null) {
			window.clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this.pollTaskId = null;
		if (clearBusy) {
			this.parseBusy = false;
			this.syncButtons();
		}
	}

	private async tickPoll(): Promise<void> {
		if (this.pollInFlight || !this.pollTaskId) {
			return;
		}
		if (Date.now() - this.pollStartedAt > POLL_TIMEOUT_MS) {
			this.stopPoll();
			this.setParseStatus("仍在处理，可稍后从历史列表导入");
			new Notice("仍在处理，可稍后从历史列表导入");
			return;
		}
		this.pollInFlight = true;
		const taskId = this.pollTaskId;
		try {
			const status = await this.api().getStatus(taskId);
			const label = status.progressDesc || progressLabel(status.status);
			this.setParseStatus(label);
			if (status.status === "FAILED" || status.status === "CANCELLED") {
				this.stopPoll();
				this.setParseStatus(status.errorMsg || label, true);
				return;
			}
			if (status.status === "COMPLETED") {
				this.stopPoll(false);
				this.setParseStatus("正在写入笔记…");
				await this.finishWrite(taskId);
				this.parseBusy = false;
				this.syncButtons();
			}
		} catch (error) {
			this.stopPoll();
			this.handleParseError(error);
		} finally {
			this.pollInFlight = false;
		}
	}

	private async finishWrite(taskId: string): Promise<void> {
		const result = await this.writeTaskNote(taskId);
		if (result === "ok") {
			this.setParseStatus("已写入笔记");
			new Notice("解析完成，已写入笔记");
			if (this.urlInput) {
				this.urlInput.value = "";
			}
			await this.reloadCompletedList();
		} else if (result === "skipped") {
			this.setParseStatus("该任务已导入，已跳过");
			new Notice("该任务已导入");
		} else {
			this.setParseStatus("写入笔记失败，可稍后从历史列表导入", true);
			new Notice("写入笔记失败，可稍后从历史列表导入");
		}
	}

	private renderList(): void {
		if (!this.listEl) {
			return;
		}
		const scrollTop = this.listEl.scrollTop;
		this.listEl.empty();
		if (this.summaryEl) {
			const selected = [...this.selected].filter((id) => !this.imported.has(id)).length;
			const loaded = this.tasks.length;
			this.summaryEl.setText(
				this.total > 0 ? `已加载 ${loaded} / ${this.total} · 已选 ${selected}` : "加载任务…",
			);
		}
		if (this.tasks.length === 0) {
			this.listEl.createDiv({ cls: "litesight-import-empty", text: this.loading ? "加载中…" : "没有已完成的任务" });
			this.syncButtons();
			return;
		}
		for (const task of this.tasks) {
			this.createCard(this.listEl, task);
		}
		this.listEl.scrollTop = scrollTop;
		this.syncButtons();
	}

	private createCard(parent: HTMLElement, task: TaskListItem): void {
		const already = this.imported.has(task.id);
		const selected = already || this.selected.has(task.id);
		const card = parent.createDiv({ cls: "litesight-import-card" });
		if (already) {
			card.addClass("is-imported");
		}
		if (selected && !already) {
			card.addClass("is-selected");
		}

		const cover = card.createDiv({ cls: "litesight-import-card-cover" });
		if (task.coverImg) {
			cover.style.backgroundImage = `url("${task.coverImg.replace(/"/g, "")}")`;
		}

		const box = cover.createEl("input", { type: "checkbox" });
		box.disabled = already;
		box.checked = selected;

		const body = card.createDiv({ cls: "litesight-import-card-body" });
		body.createDiv({ cls: "litesight-import-card-title", text: task.title || `任务 ${task.id}` });
		const meta = body.createDiv({ cls: "litesight-import-card-meta" });
		meta.createSpan({ text: dateFromCreateTime(task.createTime) });
		if (already) {
			meta.createSpan({ cls: "litesight-import-badge is-done", text: "已导入" });
		}

		if (!already) {
			const toggle = () => {
				if (this.selected.has(task.id)) {
					this.selected.delete(task.id);
				} else {
					this.selected.add(task.id);
				}
				this.renderList();
			};
			box.addEventListener("click", (event) => event.stopPropagation());
			box.addEventListener("change", toggle);
			card.addEventListener("click", toggle);
		}
	}

	private syncButtons(): void {
		const pending = [...this.selected].filter((id) => !this.imported.has(id)).length;
		if (this.moreBtn) {
			this.moreBtn.disabled = this.loading || (this.total > 0 && this.tasks.length >= this.total);
			this.moreBtn.setText(this.loading ? "加载中…" : "加载更多");
		}
		if (this.importBtn) {
			this.importBtn.disabled = this.loading || this.parseBusy || pending === 0;
			this.importBtn.setText(pending > 0 ? `导入所选（${pending}）` : "导入所选");
		}
		if (this.parseBtn) {
			this.parseBtn.disabled = this.parseBusy;
			this.parseBtn.setText(this.parseBusy ? "解析中…" : "解析");
		}
		if (this.urlInput) {
			this.urlInput.disabled = this.parseBusy;
		}
	}

	private async importSelected(): Promise<void> {
		const ids = [...this.selected].filter((id) => !this.imported.has(id));
		if (ids.length === 0) {
			new Notice("请先勾选要导入的任务");
			return;
		}
		this.loading = true;
		this.syncButtons();
		let success = 0;
		let skipped = 0;
		let failed = 0;
		for (const id of ids) {
			const result = await this.writeTaskNote(id);
			if (result === "ok") {
				success += 1;
			} else if (result === "skipped") {
				skipped += 1;
			} else {
				failed += 1;
			}
		}
		this.loading = false;
		this.renderList();
		new Notice(`导入完成：成功 ${success}，跳过 ${skipped}，失败 ${failed}`);
	}

	private async writeTaskNote(id: string): Promise<"ok" | "skipped" | "failed"> {
		try {
			if (this.imported.has(id)) {
				return "skipped";
			}
			const folder = this.plugin.settings.folder || "LiteSight";
			await ensureFolder(this.app, folder);
			const task = this.tasks.find((item) => item.id === id);
			const detail = await this.api().getTask(id);
			const markdown = buildNoteMarkdown({
				id: detail.id,
				title: detail.title || task?.title || `任务 ${id}`,
				source: detail.source,
				sourceUrl: detail.sourceUrl,
				cover: detail.coverImg,
				mediaUrl: detail.mediaUrl,
				audioUrl: detail.audioUrl,
				knowledgeDoc: detail.knowledgeDoc,
				cleanedText: detail.cleanedText,
				rawTranscript: detail.rawTranscript,
				mindMapMarkdown: detail.mindMapMarkdown,
				createTime: detail.createTime,
			});
			const fileName = await this.resolveFileName(folder, detail);
			if (!fileName) {
				return "skipped";
			}
			const created = await this.app.vault.create(`${folder}/${fileName}`, markdown);
			this.imported.set(id, created.path);
			this.plugin.settings.importedTasks[id] = created.path;
			this.selected.delete(id);
			await this.plugin.saveSettings();
			return "ok";
		} catch (error) {
			console.error("LiteSight write note failed", id, error);
			return "failed";
		}
	}

	private async mergeSavedImports(): Promise<void> {
		const saved: Record<string, string> = { ...this.plugin.settings.importedTasks };
		let dirty = false;
		for (const id of Object.keys(saved)) {
			const path = saved[id];
			if (!path) {
				delete saved[id];
				dirty = true;
				continue;
			}
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				this.imported.set(id, path);
			} else {
				delete saved[id];
				dirty = true;
			}
		}
		this.plugin.settings.importedTasks = saved;
		if (dirty) {
			await this.plugin.saveSettings();
		}
	}

	private async resolveFileName(folder: string, detail: TaskListItem): Promise<string | null> {
		const base = buildFileName(detail.createTime || "", detail.title || `任务 ${detail.id}`);
		const path = `${folder}/${base}`;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (!(existing instanceof TFile)) {
			return base;
		}
		const content = await this.app.vault.cachedRead(existing);
		const existingId = parseTaskIdFromMarkdown(content);
		if (existingId === detail.id) {
			this.imported.set(detail.id, existing.path);
			return null;
		}
		return buildFileName(detail.createTime || "", detail.title || `任务 ${detail.id}`, {
			conflict: true,
			taskId: detail.id,
		});
	}

	private setParseStatus(text: string, error = false, showCreditsLink = false): void {
		if (!this.parseStatusEl) {
			return;
		}
		this.parseStatusEl.empty();
		this.parseStatusEl.toggleClass("is-error", error);
		this.parseStatusEl.createSpan({ text });
		if (showCreditsLink) {
			this.parseStatusEl.createSpan({ text: "  " });
			const link = this.parseStatusEl.createEl("a", {
				text: "去官网充值",
				href: this.plugin.creditsUrl(),
			});
			link.addClass("litesight-external-link");
			link.addEventListener("click", (event) => {
				event.preventDefault();
				window.open(this.plugin.creditsUrl());
			});
		}
	}

	private handleParseError(error: unknown): void {
		const message = error instanceof PluginApiError ? error.message : "提交失败，请稍后重试";
		this.setParseStatus(message, true, isCreditsShortage(message));
		new Notice(message);
		if (error instanceof PluginApiError && error.status === 401) {
			this.close();
			this.plugin.openSettingTab();
		}
	}

	private handleError(error: unknown): void {
		const message = error instanceof PluginApiError ? error.message : "加载失败，请稍后重试";
		new Notice(message);
		if (error instanceof PluginApiError && error.status === 401) {
			this.close();
			this.plugin.openSettingTab();
		}
	}
}

function confirmAction(app: App, message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.setTitle("确认解析");
		modal.contentEl.createEl("p", { text: message });
		const buttons = modal.contentEl.createDiv({ cls: "modal-button-container" });
		let settled = false;
		const finish = (value: boolean) => {
			if (settled) {
				return;
			}
			settled = true;
			modal.close();
			resolve(value);
		};
		buttons.createEl("button", { text: "取消" }).addEventListener("click", () => finish(false));
		buttons.createEl("button", { text: "继续", cls: "mod-cta" }).addEventListener("click", () => finish(true));
		const originalClose = modal.close.bind(modal);
		modal.close = () => {
			originalClose();
			if (!settled) {
				settled = true;
				resolve(false);
			}
		};
		modal.open();
	});
}
