export interface TranscriptCue {
	time: string;
	text: string;
}

export function formatCueTime(minPart: string, secPart: string): string {
	const total = toInt(minPart) * 60 + Math.floor(toFloat(secPart));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	return hours > 0 ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}` : `${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

export function parseTranscriptCues(raw: string): TranscriptCue[] {
	const cues: TranscriptCue[] = [];
	const starts: Array<{ index: number; end: number; minPart: string; secPart: string }> = [];
	const source = String(raw);
	let i = 0;
	while (i < source.length) {
		const open = source.indexOf("[", i);
		if (open < 0) {
			break;
		}
		const close = source.indexOf("]", open + 1);
		if (close < 0) {
			break;
		}
		const inner = source.slice(open + 1, close);
		const comma = inner.indexOf(",");
		if (comma < 0) {
			i = close + 1;
			continue;
		}
		const startStamp = inner.slice(0, comma);
		const colon = startStamp.indexOf(":");
		if (colon < 0) {
			i = close + 1;
			continue;
		}
		const minPart = startStamp.slice(0, colon);
		const secPart = startStamp.slice(colon + 1);
		if (!isDigits(minPart) || !isSeconds(secPart)) {
			i = close + 1;
			continue;
		}
		starts.push({ index: open, end: close + 1, minPart, secPart });
		i = close + 1;
	}
	if (starts.length === 0) {
		const text = source.trim();
		return text ? [{ time: "", text }] : [];
	}
	for (let n = 0; n < starts.length; n += 1) {
		const current = starts[n];
		if (!current) {
			continue;
		}
		const next = starts[n + 1];
		const text = source.slice(current.end, next ? next.index : source.length).replace(/\s+/g, " ").trim();
		if (!text) {
			continue;
		}
		cues.push({
			time: formatCueTime(current.minPart, current.secPart),
			text,
		});
	}
	return cues;
}

export function formatTranscriptBlock(raw: string): string {
	return parseTranscriptCues(raw)
		.map((cue) => (cue.time ? `${cue.time} ${cue.text}` : cue.text))
		.join("\n");
}

function twoDigits(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

function toInt(value: string): number {
	let n = 0;
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code < 48 || code > 57) {
			return 0;
		}
		n = n * 10 + (code - 48);
	}
	return n;
}

function toFloat(value: string): number {
	const dot = value.indexOf(".");
	if (dot < 0) {
		return toInt(value);
	}
	return toInt(value.slice(0, dot)) + toInt(value.slice(dot + 1)) / 10 ** (value.length - dot - 1);
}

function isDigits(value: string): boolean {
	if (!value) {
		return false;
	}
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code < 48 || code > 57) {
			return false;
		}
	}
	return true;
}

function isSeconds(value: string): boolean {
	const dot = value.indexOf(".");
	if (dot < 0) {
		return isDigits(value);
	}
	return isDigits(value.slice(0, dot)) && isDigits(value.slice(dot + 1));
}
