import { describe, expect, it } from "vitest";
import {
  composeEntryPrompt,
  createDefaultEntrySlotValues,
  formatEntryTaskPreview,
  getEntryTaskTemplate,
  validateEntryTaskSlots,
} from "./entryPromptComposer";

describe("entryPromptComposer", () => {
  it("创建默认槽位值时应回填默认值", () => {
    const values = createDefaultEntrySlotValues("geo");

    expect(values.model_scope).toBe("DeepSeek、豆包等");
    expect(values.word_count).toBe("800-1200");
    expect(values.user_question).toBe("");
  });

  it("预览文本应展示未填写槽位占位符", () => {
    const preview = formatEntryTaskPreview("multi_angle", {
      topic: "",
      angle_count: "",
      article_type: "",
    });

    expect(preview).toContain("[输入文章主题]");
    expect(preview).toContain("2");
    expect(preview).toContain("社媒文章");
  });

  it("应正确校验必填槽位", () => {
    const result = validateEntryTaskSlots("imitate", {
      reference_style: "",
      topic: "扫地机器人",
      article_type: "测评文",
    });

    expect(result.valid).toBe(false);
    expect(result.missing.map((slot) => slot.key)).toEqual(["reference_style"]);
  });

  it("应拼装结构化入口 Prompt", () => {
    const prompt = composeEntryPrompt({
      taskType: "direct",
      slotValues: {
        topic: "春季敏感肌修护",
        article_type: "小红书文案",
      },
      userInput: "语气自然，加入真实体验感。",
      activeTheme: "social-media",
      creationMode: "guided",
      context: {
        platform: "小红书",
      },
    });

    expect(prompt).toContain("[入口任务] 直接成文");
    expect(prompt).toContain("[发布平台] 小红书");
    expect(prompt).toContain("以春季敏感肌修护为主题，创作一篇小红书文案。");
    expect(prompt).toContain("[补充要求] 语气自然，加入真实体验感。");
  });

  it("任务模板应包含描述与槽位", () => {
    const template = getEntryTaskTemplate("rewrite");

    expect(template.label).toBe("文章改写");
    expect(template.description.length).toBeGreaterThan(0);
    expect(template.slots.length).toBeGreaterThan(0);
  });
});
