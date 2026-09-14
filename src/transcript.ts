export interface TranscriptCue {
	time: string;
	text: string;
}

const STAMP = /\[(\d+):(\d+(?:\.\d+)?),\d+:\d+(?:\.\d+)?\]/g;

export function formatCueTime(minPart: string, secPart: string): string {
	const total = parseInt(minPart, 10) * 60 + Math.floor(parseFloat(secPart));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const mm = String(minutes).padStart(2, "0");
	const ss = String(seconds).padStart(2, "0");
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function parseTranscriptCues(raw: string): TranscriptCue[] {
	const cues: TranscriptCue[] = [];
	const matches = [...raw.matchAll(STAMP)];
	if (matches.length === 0) {
		const text = raw.trim();
		return text ? [{ time: "", text }] : [];
	}
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		const start = (match.index ?? 0) + match[0].length;
		const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
		const text = raw.slice(start, end).replace(/\s+/g, " ").trim();
		if (!text) {
			continue;
		}
		cues.push({
			time: formatCueTime(match[1], match[2]),
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
