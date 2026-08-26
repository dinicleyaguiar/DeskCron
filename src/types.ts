export type Trigger =
  | { type: 'startup' }
  | { type: 'cron'; expression: string; timezone?: string };

export type CommonStep = {
  id?: string;
  name?: string;
  continue_on_error?: boolean;
};

export type RunStep = CommonStep & {
  run: string;
  cwd?: string;
  timeout_seconds?: number;
  env?: Record<string, string>;
  save_as?: string;
};

export type HttpStep = CommonStep & {
  http: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    expect_status?: number[];
    timeout_seconds?: number;
  };
  save_as?: string;
};

export type OllamaStep = CommonStep & {
  ollama: {
    prompt: string;
    model?: string;
    host?: string;
    system?: string;
  };
  save_as?: string;
};

export type NotifyStep = CommonStep & {
  notify: {
    title?: string;
    message: string;
  };
};

export type Step = RunStep | HttpStep | OllamaStep | NotifyStep;

export type Workflow = {
  version: 1;
  name: string;
  description?: string;
  triggers?: Trigger[];
  env?: Record<string, string>;
  steps: Step[];
};

export type LoadedWorkflow = {
  filePath: string;
  workflow: Workflow;
};

export type RunContext = {
  variables: Record<string, string>;
  cwd: string;
};
