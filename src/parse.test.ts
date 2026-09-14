import test from "node:test";
import assert from "node:assert/strict";
import { extractHttpUrl, isCreditsShortage, isHttpUrl, progressLabel } from "./parse.ts";

test("isHttpUrl accepts http and https", () => {
	assert.equal(isHttpUrl("http://a.com"), true);
	assert.equal(isHttpUrl("https://a.com/x"), true);
	assert.equal(isHttpUrl("  https://bilibili.com/video/1  "), true);
});

test("isHttpUrl rejects empty and non-http", () => {
	assert.equal(isHttpUrl(""), false);
	assert.equal(isHttpUrl("ftp://a.com"), false);
	assert.equal(isHttpUrl("javascript:alert(1)"), false);
});

test("extractHttpUrl accepts douyin share text and bare hosts", () => {
	assert.equal(
		extractHttpUrl("6.67 复制打开抖音，看看【作品】https://v.douyin.com/v_9snFdwctU/ Oxf:/"),
		"https://v.douyin.com/v_9snFdwctU/",
	);
	assert.equal(extractHttpUrl("v.douyin.com/ieAbc123/"), "https://v.douyin.com/ieAbc123/");
	assert.equal(isHttpUrl("复制打开抖音 https://v.douyin.com/xxx/ 打开抖音"), true);
});

test("isCreditsShortage detects recharge errors", () => {
	assert.equal(isCreditsShortage("积分余额不足，请充值后重试"), true);
	assert.equal(isCreditsShortage("令牌无效或已撤销"), false);
});

test("progressLabel maps pipeline statuses", () => {
	assert.equal(progressLabel("PROBING"), "正在解析链接");
	assert.equal(progressLabel("PROCESSING_ASR"), "正在转写");
	assert.equal(progressLabel("PROCESSING_LLM"), "正在生成笔记");
	assert.equal(progressLabel("COMPLETED"), "解析完成");
	assert.equal(progressLabel("FAILED"), "解析失败");
	assert.equal(progressLabel("UNKNOWN", "自定义"), "自定义");
});
