# DeskCron

Local-first workflow automation for developers.

Run scheduled jobs, shell commands, HTTP checks, Git tasks, local Ollama prompts and desktop notifications from simple YAML files. No account and no hosted control plane are required.

> Status: early development. The v0.1 CLI is intentionally small while the workflow format stabilizes.

## Why DeskCron

Many personal developer automations do not need a cloud runner. They need a predictable process on the machine where the code, tools and local models already live.

DeskCron keeps that workflow local:

- cron and startup triggers
- shell commands
- HTTP requests
- Ollama integration
- desktop notifications
- environment-variable secrets
- overlap protection
- workflow validation

## Quick start

Requires Node.js 22.12 or newer.

```bash
npm install
npm run build
npm link

deskcron init
deskcron validate
deskcron run hello
```

Keep scheduled workflows running with:

```bash
deskcron watch
```

## A 30-second workflow

Create `.deskcron/workflows/project-check.yml`:

```yaml
version: 1
name: Project check

triggers:
  - type: cron
    expression: "0 8 * * *"

steps:
  - run: git pull --ff-only
  - run: npm test
  - notify:
      title: Project check
      message: Tests passed
```

Then run it immediately:

```bash
deskcron run project-check
```

Or keep its schedule active:

```bash
deskcron watch
```

Commands run from the directory where `deskcron` was started unless a step sets `cwd`. This makes project-local workflows work naturally from `.deskcron/workflows/`.

## Local Ollama

Ollama is optional. When installed, a workflow can use a local model without an external API key:

```yaml
version: 1
name: Commit summary

steps:
  - run: git log -10 --pretty=format:"%h %s"
    save_as: commits

  - ollama:
      model: qwen3:8b
      prompt: |
        Summarize these commits:
        {{commits}}
    save_as: summary

  - notify:
      title: Commit summary
      message: "{{summary}}"
```

The default Ollama endpoint is `http://127.0.0.1:11434`. Override it with `OLLAMA_HOST`. The default model can be set with `DESKCRON_OLLAMA_MODEL`.

## Secrets

Use environment variables rather than putting credentials in workflow files:

```yaml
steps:
  - http:
      url: https://api.example.com/health
      headers:
        Authorization: "Bearer ${API_TOKEN}"
```

An undefined environment variable causes the step to fail instead of silently sending an empty value.

## CLI

```text
deskcron init                  Create a starter workspace
deskcron list                  List workflows
deskcron validate [workflow]   Validate YAML and cron expressions
deskcron run <workflow>        Run one workflow now
deskcron watch                 Run startup triggers and schedule cron jobs
deskcron doctor                Check the local environment
```

## Workflow format

```yaml
version: 1
name: Example

description: Optional description

env:
  PROJECT: my-project

triggers:
  - type: startup
  - type: cron
    expression: "*/30 * * * *"
    timezone: America/Belem

steps:
  - name: Run a command
    run: git status --short
    cwd: .
    timeout_seconds: 30
    save_as: status

  - name: Check an endpoint
    http:
      url: https://example.com
      method: GET
      expect_status: [200]
    save_as: response

  - name: Use a local model
    ollama:
      model: qwen3:8b
      prompt: "Summarize: {{status}}"
    save_as: summary

  - notify:
      title: Finished
      message: "{{summary}}"
```

## Recipes

The `examples/` directory includes:

- Git backup
- website health check
- local Ollama Git summary

The long-term goal is to make useful workflows easy to copy, review and share.

## Security model

A DeskCron workflow can execute shell commands with your user permissions. Review workflows before running them, just as you would review a shell script or CI workflow.

DeskCron itself has no hosted service and does not require an account. See [SECURITY.md](SECURITY.md) for details.

## Roadmap

- stable workflow schema
- file-watch and Git-event triggers
- retry/backoff policies
- conditional steps
- encrypted local secrets
- background service installers for Windows, macOS and Linux
- workflow run history
- optional desktop tray UI
- community recipe catalog

## Contributing

Issues and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
