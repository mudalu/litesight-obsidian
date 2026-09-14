import { requestUrl } from "obsidian";

export class PluginApiError extends Error {
	status: number;

	constructor(message: string, status = 0) {
		super(message);
		this.name = "PluginApiError";
		this.status = status;
	}
}

export interface TaskListItem {
	id: string;
	title?: string;
	source?: string;
	sourceUrl?: string;
	coverImg?: string;
	mediaDuration?: number;
	createTime?: string;
}

export interface TaskDetail extends TaskListItem {
	knowledgeDoc?: string;
	cleanedText?: string;
	rawTranscript?: string;
	mindMapMarkdown?: string;
	mediaUrl?: string;
	audioUrl?: string;
}

export interface TaskPage {
	records: TaskListItem[];
	total: number;
	current: number;
	size: number;
	pages?: number;
}

export interface TaskSubmitResult {
	resultType?: string;
	taskId?: string;
	status?: string;
	title?: string;
	coverImg?: string;
}

export interface TaskStatus {
	id?: string;
	status?: string;
	progressDesc?: string;
	title?: string;
	errorMsg?: string;
	creditsRefunded?: boolean;
}

interface Envelope<T> {
	code?: number;
	msg?: string;
	data?: T;
}

export class LiteSightApi {
	constructor(
		private endpointBase: string,
		private token: string,
	) {}

	async listTasks(current: number, size: number): Promise<TaskPage> {
		const query = `current=${encodeURIComponent(String(current))}&size=${encodeURIComponent(String(size))}`;
		const data = await this.request<TaskPage>("GET", `/tasks?${query}`);
		const records = (data?.records ?? []).map(normalizeTask);
		return {
			records,
			total: Number(data?.total ?? 0),
			current: Number(data?.current ?? current),
			size: Number(data?.size ?? size),
			pages: data?.pages,
		};
	}

	async getTask(id: string): Promise<TaskDetail> {
		return normalizeTask(await this.request<TaskDetail>("GET", `/tasks/${encodeURIComponent(id)}`));
	}

	async submitTask(url: string): Promise<TaskSubmitResult> {
		const data = await this.request<TaskSubmitResult>("POST", "/tasks", { url });
		return {
			...data,
			taskId: data.taskId != null ? String(data.taskId) : undefined,
		};
	}

	async getStatus(id: string): Promise<TaskStatus> {
		const data = await this.request<TaskStatus>("GET", `/tasks/${encodeURIComponent(id)}/status`);
		return {
			...data,
			id: data.id != null ? String(data.id) : id,
		};
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const base = this.endpointBase.replace(/\/+$/, "");
		const response = await requestUrl({
			url: `${base}${path}`,
			method,
			headers: {
				"X-LiteSight-Plugin-Token": this.token,
				...(body !== undefined ? { "Content-Type": "application/json" } : {}),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
			throw: false,
		});
		if (response.status === 401) {
			throw new PluginApiError("令牌无效或已撤销", 401);
		}
		if (response.status < 200 || response.status >= 300) {
			throw new PluginApiError(`请求失败（${response.status}）`, response.status);
		}
		const envelope = response.json as Envelope<T>;
		if (envelope?.code !== 0) {
			throw new PluginApiError(envelope?.msg || "请求失败", response.status);
		}
		if (envelope.data === undefined || envelope.data === null) {
			throw new PluginApiError("响应为空", response.status);
		}
		return envelope.data;
	}
}

function normalizeTask<T extends TaskListItem>(task: T): T {
	return {
		...task,
		id: String(task.id),
	};
}
