import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS prompt_library (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      icon TEXT NOT NULL DEFAULT 'Sparkles',
      execution_mode TEXT NOT NULL DEFAULT 'simple',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agent_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'Bot',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  ensureDefaultPrompts(db);
  ensureDefaultProfiles(db);
}

function ensureDefaultPrompts(db: Database): void {
  const defaults: Array<{
    id: string;
    title: string;
    prompt: string;
    category: string;
    icon: string;
    execution_mode: string;
    sort_order: number;
  }> = [
    {
      id: "prompt-debug-code",
      title: "Debugar código",
      prompt: "Analise este código e encontre bugs, problemas de performance e sugestões de melhoria:",
      category: "dev",
      icon: "Bug",
      execution_mode: "simple",
      sort_order: 1,
    },
    {
      id: "prompt-review-pr",
      title: "Revisar PR",
      prompt: "Revise este diff como um senior engineer: clareza, padrões, bugs e testes:",
      category: "dev",
      icon: "Code",
      execution_mode: "simple",
      sort_order: 2,
    },
    {
      id: "prompt-meeting-notes",
      title: "Notas de reunião",
      prompt: "Transforme esta transcrição em notas estruturadas com decisões, tarefas e próximos passos:",
      category: "work",
      icon: "FileText",
      execution_mode: "simple",
      sort_order: 3,
    },
    {
      id: "prompt-email-draft",
      title: "Rascunhar email",
      prompt: "Escreva um email profissional e conciso sobre:",
      category: "work",
      icon: "MessageSquare",
      execution_mode: "simple",
      sort_order: 4,
    },
    {
      id: "prompt-explain-concept",
      title: "Explicar conceito",
      prompt: "Explique este conceito como se eu fosse um iniciante, com exemplos práticos:",
      category: "learn",
      icon: "Search",
      execution_mode: "simple",
      sort_order: 5,
    },
    {
      id: "prompt-research",
      title: "Pesquisar tema",
      prompt: "Pesquise na web com fontes e próximos passos sobre:",
      category: "learn",
      icon: "Search",
      execution_mode: "workflow",
      sort_order: 6,
    },
  ];

  for (const p of defaults) {
    const existing = db.query("SELECT id FROM prompt_library WHERE id = ?").get(p.id);
    if (existing) continue;
    db.run(
      `INSERT INTO prompt_library (id, title, prompt, category, icon, execution_mode, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.title, p.prompt, p.category, p.icon, p.execution_mode, p.sort_order],
    );
  }
}

function ensureDefaultProfiles(db: Database): void {
  const defaults: Array<{
    id: string;
    name: string;
    system_prompt: string;
    description: string;
    icon: string;
    sort_order: number;
  }> = [
    {
      id: "profile-default",
      name: "Padrão",
      system_prompt: "",
      description: "Sem system prompt customizado",
      icon: "Bot",
      sort_order: 0,
    },
    {
      id: "profile-developer",
      name: "Developer",
      system_prompt:
        "Você é um engenheiro de software sênior. Responda com código limpo, explique decisões técnicas e sugira boas práticas.",
      description: "Foco em código, arquitetura e debugging",
      icon: "Code",
      sort_order: 1,
    },
    {
      id: "profile-writer",
      name: "Writer",
      system_prompt:
        "Você é um escritor técnico. Priorize clareza, concisão e estrutura. Use Markdown quando apropriado.",
      description: "Foco em escrita clara e estruturada",
      icon: "PenLine",
      sort_order: 2,
    },
    {
      id: "profile-analyst",
      name: "Analyst",
      system_prompt:
        "Você é um analista de dados. Seja objetivo, baseie-se em evidências e estruture respostas com dados.",
      description: "Foco em análise objetiva e dados",
      icon: "Layers",
      sort_order: 3,
    },
  ];

  for (const p of defaults) {
    const existing = db.query("SELECT id FROM agent_profiles WHERE id = ?").get(p.id);
    if (existing) continue;
    db.run(
      `INSERT INTO agent_profiles (id, name, system_prompt, description, icon, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.system_prompt, p.description, p.icon, p.sort_order],
    );
  }
}
