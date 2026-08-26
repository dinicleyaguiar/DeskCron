export type OllamaRequest = {
  host: string;
  model: string;
  prompt: string;
  system?: string;
  timeoutSeconds?: number;
};

export async function ollamaGenerate(request: OllamaRequest): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (request.timeoutSeconds ?? 600) * 1000);

  try {
    const response = await fetch(`${request.host.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        stream: false,
        messages: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          { role: 'user', content: request.prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    if (!content) throw new Error('Ollama returned an empty response');
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${request.timeoutSeconds ?? 600}s`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaAvailable(host = 'http://127.0.0.1:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}
