/**
 * 测试 New API 图片生成
 * 运行: npx tsx scripts/test-newapi-image.ts
 * 
 * 生成的图片保存到 scripts/test-output/ 目录
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_HOST = "http://127.0.0.1:8045";
const API_KEY = "sk-1b2d91c47f4d455485fdd8f4fe52883e";
const MODEL = "gemini-3-pro-image";
const OUTPUT_DIR = path.join(__dirname, "test-output");

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 从 base64 数据保存图片
 */
function saveBase64Image(base64Data: string, filename: string): string {
  const buffer = Buffer.from(base64Data, "base64");
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

/**
 * 从 URL 下载并保存图片
 */
async function downloadImage(url: string, filename: string): Promise<string> {
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

/**
 * 提取图片 URL 或 base64
 */
function extractImageData(content: string): { type: "url" | "base64"; data: string } | null {
  // 方式 1: Markdown 图片格式 ![...](url)
  const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
  if (mdMatch) return { type: "url", data: mdMatch[1] };

  // 方式 2: 纯图片 URL
  const urlMatch = content.match(/(https?:\/\/[^\s\)\"\'<>]+\.(png|jpg|jpeg|gif|webp)[^\s\)\"\'<>]*)/i);
  if (urlMatch) return { type: "url", data: urlMatch[1] };

  // 方式 3: 任意 https URL (可能是图片)
  const anyUrlMatch = content.match(/(https?:\/\/[^\s\)\"\'<>]+)/);
  if (anyUrlMatch) return { type: "url", data: anyUrlMatch[1] };

  // 方式 4: base64 数据
  const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
  if (base64Match) return { type: "base64", data: base64Match[1] };

  return null;
}

async function testImageGen() {
  console.log("=== 测试 New API 图片生成 ===\n");
  console.log("输出目录:", OUTPUT_DIR);

  const request = {
    model: MODEL,
    messages: [{ role: "user", content: "Draw a cute cat" }],
    temperature: 0.7,
    stream: false,
    size: "1024x1024",
  };

  console.log("\n请求:", JSON.stringify(request, null, 2));
  console.log("\n发送请求到:", `${API_HOST}/v1/chat/completions`);

  try {
    const response = await fetch(`${API_HOST}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(request),
    });

    console.log("\n响应状态:", response.status);

    const data = await response.json();
    
    // 保存完整响应到 JSON 文件（避免 console 输出过长）
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const responseFile = path.join(OUTPUT_DIR, `response-${timestamp}.json`);
    fs.writeFileSync(responseFile, JSON.stringify(data, null, 2));
    console.log("\n完整响应已保存到:", responseFile);

    // 提取消息内容
    const content = data.choices?.[0]?.message?.content || "";
    const contentPreview = content.length > 200 ? content.slice(0, 200) + "..." : content;
    console.log("\n消息内容预览:", contentPreview);

    // 尝试提取并保存图片
    const imageData = extractImageData(content);
    
    if (imageData) {
      console.log("\n检测到图片数据，类型:", imageData.type);
      
      const filename = `image-${timestamp}.png`;
      let savedPath: string;
      
      if (imageData.type === "base64") {
        savedPath = saveBase64Image(imageData.data, filename);
      } else {
        console.log("图片 URL:", imageData.data);
        savedPath = await downloadImage(imageData.data, filename);
      }
      
      console.log("\n✅ 图片已保存到:", savedPath);
      console.log("\n可以在 Kiro 中打开查看图片");
    } else {
      console.log("\n❌ 未能从响应中提取图片数据");
      console.log("请检查 response JSON 文件查看完整响应格式");
    }

  } catch (error) {
    console.error("\n❌ 请求失败:", error);
  }
}

testImageGen();
