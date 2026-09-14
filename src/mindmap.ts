import { zoomIdentity } from "d3";
import { MarkdownRenderChild } from "obsidian";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { capNodeWidths } from "./mindmap-layout";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const PAD = 20;

export class LiteSightMindmapChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly source: string,
	) {
		super(containerEl);
	}

	onload(): void {
		const cleanup = mountMindmap(this.containerEl, this.source);
		this.register(cleanup);
	}
}

export function mountMindmap(container: HTMLElement, markdown: string): () => void {
	container.empty();
	container.addClass("litesight-mindmap");

	const toolbar = container.createDiv({ cls: "litesight-mindmap-toolbar" });
	const canvas = container.createDiv({ cls: "litesight-mindmap-canvas" });
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	canvas.appendChild(svg);

	if (!markdown.trim()) {
		container.createDiv({ cls: "litesight-mindmap-empty", text: "没有脑图内容" });
		return () => undefined;
	}

	const transformer = new Transformer();
	let mm: Markmap;
	try {
		mm = Markmap.create(svg, {
			autoFit: false,
			duration: 0,
			maxWidth: 160,
			paddingX: 8,
			spacingHorizontal: 32,
			spacingVertical: 8,
			zoom: true,
			pan: true,
			color: (node: { depth?: number }) => COLORS[(node.depth ?? 0) % COLORS.length],
		});
		ensureMeasureStyle();
		const { root } = transformer.transform(markdown);
		mm.setData(root);
		capNodeWidths(mm.state.data);
		mm.renderData();
	} catch {
		container.createDiv({ cls: "litesight-mindmap-empty", text: "脑图渲染失败，请检查内容格式" });
		return () => undefined;
	}

	const layout = () => applyCompactView(mm);
	requestAnimationFrame(layout);

	const addBtn = (label: string, title: string, onClick: () => void) => {
		const button = toolbar.createEl("button", { text: label, attr: { type: "button", title } });
		button.addEventListener("click", onClick);
	};
	addBtn("放大", "放大", () => mm.rescale(1.25));
	addBtn("缩小", "缩小", () => mm.rescale(0.8));
	addBtn("适应", "按内容适配，不拉长连线", layout);

	const observer = new ResizeObserver((entries) => {
		const rect = entries[0]?.contentRect;
		if (!rect || rect.width < 40 || rect.height < 40) {
			return;
		}
		layout();
	});
	observer.observe(canvas);
	return () => {
		observer.disconnect();
		mm.destroy();
	};
}

const MEASURE_STYLE_ID = "litesight-markmap-measure";

function ensureMeasureStyle(): void {
	if (document.getElementById(MEASURE_STYLE_ID)) {
		return;
	}
	const style = document.createElement("style");
	style.id = MEASURE_STYLE_ID;
	style.textContent = `
.markmap-container {
	width: max-content !important;
	max-width: none !important;
	height: auto !important;
}
.markmap-container .markmap-foreign,
.markmap-container .markmap-foreign > div {
	display: inline-block !important;
	width: max-content !important;
	max-width: 180px !important;
	box-sizing: content-box !important;
}
`;
	document.head.appendChild(style);
}

function applyCompactView(mm: Markmap): void {
	const svgEl = mm.svg.node() as SVGSVGElement | null;
	if (!svgEl) {
		return;
	}
	const { width, height } = svgEl.getBoundingClientRect();
	if (width < 40 || height < 40) {
		return;
	}
	const { minX, maxX, minY, maxY } = mm.state;
	const contentW = Math.max(maxY - minY, 1);
	const contentH = Math.max(maxX - minX, 1);
	const scale = Math.min((width - PAD * 2) / contentW, (height - PAD * 2) / contentH, 1);
	const x = PAD - minY * scale;
	const y = PAD - minX * scale;
	mm.svg.call(mm.zoom.transform, zoomIdentity.translate(x, y).scale(scale));
}
