import type { CompletionChunk, CompletionInput, CompletionOutput } from "@desktop-agent/shared";
import type { LlmProvider } from "../types";

const MOCK_RESPONSES: Record<string, string> = {
  "text.rewrite": `# Melhorias aplicadas

## Clareza
- Frases mais diretas e objetivas
- Removidas redundâncias e palavras desnecessárias

## Estrutura
- Parágrafos reorganizados para fluxo lógico
- Adicionadas transições entre seções

## Tom
- Linguagem mais profissional e consistente
- Voz ativa substituindo passiva onde aplicável

---

*Revisão gerada pelo MockProvider. Configure um provider real para resultados personalizados.*`,

  "text.summarize": `## Resumo

Este texto aborda os principais pontos sobre o tema apresentado, destacando:

1. Contexto inicial e premissas fundamentais
2. Desenvolvimento dos argumentos centrais
3. Conclusões e implicações práticas

---

*Resumo gerado pelo MockProvider.*`,

  "text.translate": `# Tradução

O texto foi traduzido mantendo o significado original e adaptando expressões idiomáticas para o contexto cultural do idioma de destino.

---

*Tradução gerada pelo MockProvider.*`,
};

export class MockProvider implements LlmProvider {
  name = "mock";
  kind = "mock" as const;

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const userMessage = input.messages.find((m) => m.role === "user")?.content ?? "";
    const toolMatch = Object.keys(MOCK_RESPONSES).find((key) => userMessage.includes(key));
    const content = toolMatch
      ? MOCK_RESPONSES[toolMatch]!
      : `Resposta mock para: "${userMessage.slice(0, 100)}"`;

    return {
      content,
      model: "mock-model",
      usage: { promptTokens: 10, completionTokens: content.length },
    };
  }

  async *stream(input: CompletionInput): AsyncIterable<CompletionChunk> {
    const output = await this.complete(input);
    const words = output.content.split(" ");
    for (let i = 0; i < words.length; i++) {
      if (input.signal?.aborted) {
        throw new Error("Execução abortada pelo usuário.");
      }
      yield {
        content: (i === 0 ? "" : " ") + words[i],
        done: i === words.length - 1,
      };
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 20);
        const abort = () => {
          clearTimeout(timer);
          reject(new Error("Execução abortada pelo usuário."));
        };
        if (input.signal?.aborted) {
          abort();
          return;
        }
        input.signal?.addEventListener("abort", abort, { once: true });
      });
    }
  }
}
