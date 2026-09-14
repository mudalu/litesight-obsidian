const EMBEDDED_URL = /https?:\/\/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]/i;
const BARE_HOST_URL =
	/\b(?:(?:v\.)?douyin\.com|www\.bilibili\.com|b23\.tv|xhslink\.com|www\.xiaohongshu\.com|v\.qq\.com|www\.kuaishou\.com)\/[^\s\u4e00-\u9fff]+/i;

export function extractHttpUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) {
		return "";
	}
	const embedded = trimmed.match(EMBEDDED_URL);
	if (embedded) {
		return embedded[0];
	}
	const protoRel = trimmed.match(/\/\/(?:v\.)?douyin\.com\/[^\s\u4e00-\u9fff]+/i);
	if (protoRel) {
		return `https:${protoRel[0]}`;
	}
	const bare = trimmed.match(BARE_HOST_URL);
	if (bare) {
		return `https://${bare[0].replace(/[.,;!?）】]+$/, "")}`;
	}
	return trimmed;
}

export function isHttpUrl(raw: string): boolean {
	return /^https?:\/\//i.test(extractHttpUrl(raw));
}

export function isCreditsShortage(message: string): boolean {
	return /积分/.test(message) && /不足|充值/.test(message);
}

export function progressLabel(status?: string, fallback?: string): string {
	switch (status) {
		case "PENDING":
		case "PROBING":
			return "正在解析链接";
		case "PROCESSING_ASR":
			return "正在转写";
		case "PROCESSING_LLM":
			return "正在生成笔记";
		case "COMPLETED":
			return "解析完成";
		case "FAILED":
			return "解析失败";
		case "CANCELLED":
			return "已取消";
		default:
			return fallback || "处理中…";
	}
}
