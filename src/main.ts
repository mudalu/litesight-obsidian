import { addIcon, Notice, Plugin } from "obsidian";
import { ImportModal } from "./import-modal";
import { LiteSightCuesChild } from "./cues";
import { LITESIGHT_ICON_ID, LITESIGHT_ICON_SVG } from "./icon";
import { LiteSightMindmapChild } from "./mindmap";
import { DEFAULT_SETTINGS, LiteSightSettingTab, websiteCreditsUrl, websiteHomeUrl, type LiteSightSettings } from "./settings";

export default class LiteSightPlugin extends Plugin {
	settings: LiteSightSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();
		addIcon(LITESIGHT_ICON_ID, LITESIGHT_ICON_SVG);
		this.addRibbonIcon(LITESIGHT_ICON_ID, "轻析 LiteSight", () => this.openImport());
		this.addCommand({
			id: "sync-litesight-history",
			name: "轻析：解析与导入",
			callback: () => this.openImport(),
		});
		this.addSettingTab(new LiteSightSettingTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor("litesight-mindmap", (source, el, ctx) => {
			ctx.addChild(new LiteSightMindmapChild(el, source));
		});
		this.registerMarkdownCodeBlockProcessor("litesight-cues", (source, el, ctx) => {
			ctx.addChild(new LiteSightCuesChild(el, source));
		});
	}

	openImport(): void {
		if (!this.settings.token.trim()) {
			new Notice("请先在设置中填写轻析令牌");
			this.openSettingTab();
			return;
		}
		new ImportModal(this).open();
	}

	openSettingTab(): void {
		const setting = (this.app as unknown as { setting?: { open: () => void; openTabById: (id: string) => void } }).setting;
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings.importedTasks = { ...(this.settings.importedTasks || {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	websiteUrl(): string {
		return websiteHomeUrl();
	}

	creditsUrl(): string {
		return websiteCreditsUrl();
	}
}
