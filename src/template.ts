export function expandEnv(input: string, env: NodeJS.ProcessEnv = process.env): string {
  return input.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/gi, (_match, name: string) => {
    const value = env[name];
    if (value === undefined) {
      throw new Error(`Environment variable ${name} is not defined`);
    }
    return value;
  });
}

export function renderVariables(input: string, variables: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) {
      throw new Error(`Workflow variable ${name} is not defined`);
    }
    return value;
  });
}

export function render(input: string, variables: Record<string, string>): string {
  return renderVariables(expandEnv(input), variables);
}
