export type Trigger =
  | { type: 'startup' }
  | { type: 'cron'; expression: string; timezone?: string };

export type RetryPolicy = {
  attempts: number;
  delay_seconds?: number;
  backoff?: number;
  max_delay_seconds?: number;
};

export type CommonStep = {
  id?: string;
  name?: string;
  if?: string;
  needs?: string[];
  continue_on_error?: boolean;
  retry?: RetryPolicy;
  timeout_seconds?: number;
};

export type RunStep = CommonStep & {
  run: string;
  cwd?: string;
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

export type StepStatus = 'success' | 'failed' | 'skipped' | 'planned';

export type StepResult = {
  id: string;
  index: number;
  name: string;
  type: 'run' | 'http' | 'ollama' | 'notify';
  status: StepStatus;
  attempts: number;
  duration_ms: number;
  error?: string;
};

export type RunContext = {
  variables: Record<string, string>;
  cwd: string;
  stepResults: Record<string, StepResult>;
  hadFailure: boolean;
  dryRun: boolean;
};

export type WorkflowRunStatus = 'success' | 'partial' | 'failed' | 'dry-run';

export type WorkflowRunRecord = {
  id: string;
  workflow: string;
  file: string;
  cwd: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  status: WorkflowRunStatus;
  dry_run: boolean;
  steps: StepResult[];
};

export type RunOptions = {
  dryRun?: boolean;
  recordHistory?: boolean;
};
