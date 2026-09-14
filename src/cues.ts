import { MarkdownRenderChild } from "obsidian";

const LINE = /^(\d+:\d{2}(?::\d{2})?)\s+(.*)$/;

export class LiteSightCuesChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly source: string,
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.empty();
		this.containerEl.addClass("litesight-cues");
		const lines = this.source.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			const row = this.containerEl.createDiv({ cls: "litesight-cue" });
			const match = trimmed.match(LINE);
			if (match) {
				row.createSpan({ cls: "litesight-cue-time", text: match[1] });
				row.createDiv({ cls: "litesight-cue-text", text: match[2] });
			} else {
				row.createDiv({ cls: "litesight-cue-text", text: trimmed });
			}
		}
	}
}
