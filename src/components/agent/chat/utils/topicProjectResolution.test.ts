import { describe, expect, it } from "vitest";
import {
  isLockedProjectConflict,
  normalizeProjectId,
  resolveTopicProjectId,
} from "./topicProjectResolution";

describe("normalizeProjectId", () => {
  it("应拒绝空值和非法占位符", () => {
    expect(normalizeProjectId(null)).toBeNull();
    expect(normalizeProjectId(undefined)).toBeNull();
    expect(normalizeProjectId("   ")).toBeNull();
    expect(normalizeProjectId("__invalid__")).toBeNull();
    expect(normalizeProjectId("[object Promise]")).toBeNull();
  });

  it("应返回合法项目 ID", () => {
    expect(normalizeProjectId(" project-1 ")).toBe("project-1");
  });
});

describe("resolveTopicProjectId", () => {
  it("应优先使用话题绑定项目", () => {
    expect(
      resolveTopicProjectId({
        topicBoundProjectId: "topic-project",
        lastProjectId: "last-project",
        defaultProjectId: "default-project",
      }),
    ).toBe("topic-project");
  });

  it("应在无话题绑定时使用上次项目", () => {
    expect(
      resolveTopicProjectId({
        topicBoundProjectId: null,
        lastProjectId: "last-project",
        defaultProjectId: "default-project",
      }),
    ).toBe("last-project");
  });

  it("应在前两者缺失时回退默认项目", () => {
    expect(
      resolveTopicProjectId({
        topicBoundProjectId: null,
        lastProjectId: null,
        defaultProjectId: "default-project",
      }),
    ).toBe("default-project");
  });
});

describe("isLockedProjectConflict", () => {
  it("锁定项目与目标项目不同应判定冲突", () => {
    expect(isLockedProjectConflict("project-a", "project-b")).toBe(true);
  });

  it("锁定项目与目标项目相同不冲突", () => {
    expect(isLockedProjectConflict("project-a", "project-a")).toBe(false);
  });
});
