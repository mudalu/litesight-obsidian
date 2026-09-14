import { App, PluginSettingTab, Setting } from "obsidian";
import type LiteSightPlugin from "./main";

/** 生产环境固定，用户无需配置 */
export const PRODUCTION_ENDPOINT = "https://www.litesight.cn/api/admin/ls/plugin/v1";
export const PRODUCTION_WEBSITE = "https://www.litesight.cn";

export interface LiteSightSettings {
	token: string;
	folder: string;
	importedTasks: Record<string, string>;
}

export const DEFAULT_SETTINGS: LiteSightSettings = {
	token: "",
	folder: "LiteSight",
	importedTasks: {},
};

export function websiteHomeUrl(): string {
	return PRODUCTION_WEBSITE;
}

export function websiteCreditsUrl(): string {
	return `${PRODUCTION_WEBSITE}/#/c/credits`;
}

export class LiteSightSettingTab extends PluginSettingTab {
	plugin: LiteSightPlugin;

	constructor(app: App, plugin: LiteSightPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "轻析 LiteSight" });

		new Setting(containerEl)
			.setName("插件令牌")
			.setDesc("在轻析网站「账号设置」中生成，ls_ 开头")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("ls_...")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("笔记文件夹")
			.setDesc("相对当前库的目录，不存在时导入会创建")
			.addText((text) =>
				text
					.setPlaceholder("LiteSight")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value.trim().replace(/^\/+|\/+$/g, "") || "LiteSight";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("官网")
			.setDesc("充值与生成令牌请在轻析官网完成")
			.addButton((button) =>
				button.setButtonText("打开官网").onClick(() => {
					window.open(websiteHomeUrl());
				}),
			);
	}
}
