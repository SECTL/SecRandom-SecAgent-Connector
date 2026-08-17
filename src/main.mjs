const endpoint = process.env.SECRANDOM_URL || "http://127.0.0.1:3910/api/secagent/v1";

async function request(api, path, init = {}) {
  const response = await api.fetch(`${endpoint}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `SecRandom HTTP ${response.status}`);
  return data;
}

function jsonInit(body, method = "POST") {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

const chineseDigits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function parseCount(value) {
  if (!value) return 1;
  if (/^\d+$/u.test(value)) return Number(value);
  let total = 0;
  let current = 0;
  for (const char of value) {
    if (char in chineseDigits) { current = chineseDigits[char]; continue; }
    if (char === "十" || char === "百") {
      const unit = char === "十" ? 10 : 100;
      total += (current || 1) * unit;
      current = 0;
      continue;
    }
    return NaN;
  }
  return total + current;
}

function renderDrawResult(result) {
  const students = result && typeof result === "object" && Array.isArray(result.students) ? result.students : [];
  const names = students.map((student) => typeof student === "string" ? student : student?.name || student?.student_name || student?.id).filter(Boolean);
  if (names.length) return `抽到${names.length}人：${names.join("、")}`;
  if (result?.status === "empty") return "没有抽到符合条件的学生。";
  return "抽取已完成，但 SecRandom 没有返回学生名单。";
}

export function parseDrawPreRule(input) {
  const text = String(input || "").trim().replace(/[。！？!?，,；;]+$/u, "").replace(/\s+/gu, "");
  const match = text.match(/^(?:请|帮我)?(点个名|点名|抽个人|抽人|抽|随机抽选|随机抽取|随机)(?:(\d+|[零〇一二两三四五六七八九十百]+)个?)?(女生|男生)?人?$/u);
  if (!match) return undefined;
  const count = parseCount(match[2]);
  if (!Number.isInteger(count) || count < 1 || count > 100) return undefined;
  const gender = match[3] === "女生" ? "女" : match[3] === "男生" ? "男" : undefined;
  return {
    tool: "draw_students",
    arguments: { mode: count === 1 ? "flash" : "result_only", count, ...(gender ? { gender } : {}) },
    render: renderDrawResult
  };
}

export async function activate(api) {
  api.registerSkill("skills/secrandom/SKILL.md");
  let connected = false;
  let registered = false;

  const registerTools = () => {
    if (registered) return;
    api.registerTool({
      name: "list_students",
      description: "读取 SecRandom 当前名单。",
      hidden: true,
      inputSchema: { type: "object", additionalProperties: false, properties: {} }
    }, async () => request(api, "/students", { method: "GET" }));

    api.registerTool({
      name: "upsert_student",
      description: "新增或更新 SecRandom 名单中的一名学生。调用前必须读取 secrandom Skill。",
      hidden: true,
      inputSchema: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: {
          record_id: { type: "string" }, id: { type: "string" }, name: { type: "string" },
          group: { type: "string" }, gender: { type: "string" }, tags: { type: "string" }, exists: { type: "boolean" }
        }
      }
    }, async (args) => request(api, "/students", jsonInit(args)));

    api.registerTool({
      name: "remove_student",
      description: "从 SecRandom 当前名单移除一名学生。调用前必须读取 secrandom Skill。",
      hidden: true,
      inputSchema: {
        type: "object", additionalProperties: false,
        properties: { record_id: { type: "string" }, id: { type: "string" }, name: { type: "string" } }
      }
    }, async (args) => request(api, "/students", jsonInit(args, "DELETE")));

    api.registerTool({
      name: "draw_students",
      description: "从 SecRandom 抽取学生。flash 仅抽 1 人并使用原通知渠道；result_only 只返回结果不发送通知。支持按标签、学号和姓名指定范围。",
      hidden: false,
      inputSchema: {
        type: "object", additionalProperties: false, required: ["mode"],
        properties: {
          mode: { type: "string", enum: ["flash", "result_only"] }, count: { type: "integer", minimum: 1, maximum: 100 },
          gender: { type: "string", description: "可选，按性别筛选，例如女或男" }, include_tags: { type: "array", items: { type: "string" } }, exclude_tags: { type: "array", items: { type: "string" } },
          include_ids: { type: "array", items: { type: "string" } }, include_names: { type: "array", items: { type: "string" } }
        }
      }
    }, async (args) => request(api, "/draw/students", jsonInit(args)));
    if (typeof api.registerPreRule === "function") api.registerPreRule("draw_students_command", parseDrawPreRule);
    registered = true;
  };

  const unregisterTools = () => {
    if (!registered) return;
    if (typeof api.unregisterPreRule === "function") api.unregisterPreRule("draw_students_command");
    for (const name of ["list_students", "upsert_student", "remove_student", "draw_students"]) api.unregisterTool(name);
    registered = false;
  };

  async function connect() {
    try {
      await request(api, "/students", { method: "GET", signal: AbortSignal.timeout(1500) });
      connected = true; registerTools(); api.setStatus(`已连接 SecRandom：${endpoint}`);
    } catch (error) {
      connected = false; unregisterTools();
      // The connector is still running normally while SecRandom is offline.
      // Keep the plugin ready and expose the connection state in the message.
      api.setStatus(`等待 SecRandom：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await connect();
  const timer = setInterval(() => { void connect(); }, 5000);
  return () => { clearInterval(timer); unregisterTools(); if (connected) api.setStatus("SecRandom 已断开"); };
}
