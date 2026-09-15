import { addIcon, App, Notice, Plugin } from "obsidian";
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
			id: "parse-and-import",
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
		const setting = getSettingsUi(this.app);
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<LiteSightSettings> | null;
		this.settings = {
			token: typeof data?.token === "string" ? data.token : DEFAULT_SETTINGS.token,
			folder: typeof data?.folder === "string" && data.folder.trim() ? data.folder : DEFAULT_SETTINGS.folder,
			importedTasks: { ...(data?.importedTasks ?? {}) },
		};
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

interface SettingsUi {
	open(): void;
	openTabById(id: string): void;
}

function getSettingsUi(app: App): SettingsUi | undefined {
	if (!("setting" in app)) {
		return undefined;
	}
	const setting = (app as App & { setting?: SettingsUi }).setting;
	if (!setting || typeof setting.open !== "function" || typeof setting.openTabById !== "function") {
		return undefined;
	}
	return setting;
}
