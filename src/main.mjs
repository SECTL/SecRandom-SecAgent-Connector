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
      description: "从 SecRandom 抽取学生；调用前必须读取 secrandom Skill。",
      hidden: true,
      inputSchema: {
        type: "object", additionalProperties: false, required: ["mode"],
        properties: {
          mode: { type: "string", enum: ["flash", "result_only"] }, count: { type: "integer", minimum: 1, maximum: 100 },
          include_tags: { type: "array", items: { type: "string" } }, exclude_tags: { type: "array", items: { type: "string" } },
          include_ids: { type: "array", items: { type: "string" } }, include_names: { type: "array", items: { type: "string" } }
        }
      }
    }, async (args) => request(api, "/draw/students", jsonInit(args)));
    registered = true;
  };

  const unregisterTools = () => {
    if (!registered) return;
    for (const name of ["list_students", "upsert_student", "remove_student", "draw_students"]) api.unregisterTool(name);
    registered = false;
  };

  async function connect() {
    try {
      await request(api, "/students", { method: "GET", signal: AbortSignal.timeout(1500) });
      connected = true; registerTools(); api.setStatus(`已连接 SecRandom：${endpoint}`);
    } catch (error) {
      connected = false; unregisterTools();
      api.setStatus(`等待 SecRandom：${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
  await connect();
  const timer = setInterval(() => { void connect(); }, 5000);
  return () => { clearInterval(timer); unregisterTools(); if (connected) api.setStatus("SecRandom 已断开", "error"); };
}
