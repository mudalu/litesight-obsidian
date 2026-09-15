export const NODE_WIDTH_CAP = 180;

export type SizedNode = {
	state?: { size?: number[] };
	children?: SizedNode[] | null;
};

export function capNodeWidths(node: SizedNode | null | undefined, maxWidth = NODE_WIDTH_CAP): void {
	if (!node) {
		return;
	}
	const size = node.state?.size;
	if (size && size.length > 0) {
		const width = Number(size[0]);
		size[0] = Math.min(Number.isFinite(width) && width > 0 ? width : 1, maxWidth);
	}
	if (Array.isArray(node.children)) {
		for (const child of node.children) {
			capNodeWidths(child, maxWidth);
		}
	}
}
