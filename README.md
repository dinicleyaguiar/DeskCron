# DeskCron

[![CI](https://github.com/dinicleyaguiar/DeskCron/actions/workflows/ci.yml/badge.svg)](https://github.com/dinicleyaguiar/DeskCron/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/dinicleyaguiar/DeskCron?display_name=tag)](https://github.com/dinicleyaguiar/DeskCron/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/node-%3E%3D22.12-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

Local-first workflow automation for developers.

DeskCron runs shell commands, HTTP checks, Git tasks, local Ollama prompts and desktop notifications from small YAML workflows. It has no hosted control plane and requires no account.

Status: v0.3.0 Public Preview

## Why DeskCron

A lot of developer automation belongs on the machine where the repository, containers, credentials and local tools already live.

DeskCron gives those jobs a small, reviewable workflow file:

```yaml
version: 1
name: Project check

triggers:
  - type: cron
    expression: "0 8 * * *"

steps:
  - id: tests
    retry:
      attempts: 2
      delay_seconds: 2
    timeout_seconds: 300
    run: npm test

  - id: done
    needs: [tests]
    notify:
      title: Project check
      message: Tests passed
```

Run it now:

```bash
deskcron run project-check
```

Or keep startup and cron workflows active:

```bash
deskcron watch
```

## Highlights

- local-first: workflows execute on your machine
- YAML workflows that are easy to review and version
- manual, startup and cron triggers
- shell, HTTP, Ollama and desktop notification steps
- dry-run execution plans
- retries with delay and exponential backoff
- per-step timeouts
- safe conditional expressions
- step dependencies with `needs`
- local JSONL run history
- overlap prevention
- environment-variable secrets
- bundled, copyable workflow recipes
- Windows and Linux CI coverage

## Requirements

- Node.js 22.12 or newer
- npm
- optional: Ollama for local model steps

## Install

### From GitHub

After the `v0.3.0` tag is published:

```bash
npm install -g github:dinicleyaguiar/DeskCron#v0.3.0
```

Then:

```bash
deskcron doctor
```

### From source

```bash
git clone https://github.com/dinicleyaguiar/DeskCron.git
cd DeskCron
npm install
npm run check
npm link
```

## 30-second start

Create a workspace:

```bash
deskcron init
```

Validate workflows:

```bash
deskcron validate
```

Preview without side effects:

```bash
deskcron run hello --dry-run
```

Run it:

```bash
deskcron run hello
```

## Recipes

DeskCron ships with workflows you can copy into a project.

```bash
deskcron recipes
deskcron recipe website-check
deskcron validate
deskcron run website-check --dry-run
```

Bundled recipes:

| Recipe | Purpose |
| --- | --- |
| `api-health` | Check an authenticated API endpoint |
| `docker-compose-health` | Inspect a local Docker Compose stack |
| `git-backup` | Commit and push local changes |
| `git-dirty-notify` | Notify when a repository has uncommitted changes |
| `local-service-check` | Check a service running on localhost |
| `npm-project-check` | Run tests and build an npm project |
| `ollama-summary` | Summarize recent Git commits locally |
| `website-check` | Check whether a website responds successfully |

Recipes are normal YAML files. Review and edit them before running.

## Conditions

DeskCron deliberately keeps conditions small and predictable. It does not evaluate JavaScript from `if` expressions.

Supported forms:

```yaml
if: always()
if: success()
if: failure()
if: exists(API_TOKEN)
if: empty(changes)
if: changes == ""
if: environment != "production"
```

Variables created with `save_as` and process environment variables can be used in conditions.

```yaml
steps:
  - id: status
    run: git status --porcelain
    save_as: changes

  - id: commit
    needs: [status]
    if: changes != ""
    run: git add --all && git commit -m "chore: local backup"
```

## Dependencies

Give a step an `id`, then reference earlier successful steps with `needs`:

```yaml
steps:
  - id: test
    run: npm test

  - id: build
    needs: [test]
    run: npm run build

  - id: notify
    needs: [build]
    notify:
      title: DeskCron
      message: Build finished
```

A step is skipped when one of its required dependencies did not finish successfully.

## Retries and backoff

```yaml
steps:
  - id: push
    retry:
      attempts: 4
      delay_seconds: 2
      backoff: 2
      max_delay_seconds: 30
    timeout_seconds: 60
    run: git push
```

`attempts` is the total number of attempts, including the first one.

## Timeouts

`timeout_seconds` works on shell, HTTP, Ollama and notification steps:

```yaml
steps:
  - timeout_seconds: 120
    run: npm test
```

For compatibility, HTTP steps may also place `timeout_seconds` inside `http`; the top-level value takes precedence.

## Run history

Real runs are recorded locally at:

```text
.deskcron/history/runs.jsonl
```

This directory is ignored by the default `.gitignore`.

```bash
deskcron history
deskcron history --workflow "Website" --limit 50
deskcron history --json
```

DeskCron does not store command stdout, workflow variables or Ollama responses in run history. History contains execution metadata and compact error information.

## Local Ollama

Ollama is optional. A workflow can call a local model without an external API key:

```yaml
version: 1
name: Commit summary

steps:
  - id: commits
    run: git log -10 --pretty=format:"%h %s"
    save_as: commits

  - id: summary
    needs: [commits]
    timeout_seconds: 120
    ollama:
      model: qwen3:8b
      prompt: |
        Summarize these commits:
        {{commits}}
    save_as: summary

  - id: notify
    needs: [summary]
    notify:
      title: Commit summary
      message: "{{summary}}"
```

The default endpoint is `http://127.0.0.1:11434`. Override it with `OLLAMA_HOST`. Set a default model with `DESKCRON_OLLAMA_MODEL`.

## Secrets

Keep credentials in environment variables rather than workflow files:

```yaml
steps:
  - http:
      url: https://api.example.com/health
      headers:
        Authorization: "Bearer ${API_TOKEN}"
```

An undefined environment variable causes the step to fail instead of silently substituting an empty string.

## CLI

```text
deskcron init                    Create a starter workspace
deskcron list                    List workflows
deskcron validate [workflow]     Validate YAML, conditions, dependencies and cron
deskcron run <workflow>          Run a workflow now
deskcron run <workflow> --dry-run
                                 Preview a workflow without side effects
deskcron watch                   Run startup triggers and schedule cron jobs
deskcron history                 Show local run history
deskcron recipes                 List bundled recipes
deskcron recipe <name>           Copy a recipe into .deskcron/workflows
deskcron doctor                  Check the local environment
```

## Workflow reference

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
  - id: status
    name: Run a command
    run: git status --short
    cwd: .
    timeout_seconds: 30
    save_as: git_status

  - id: endpoint
    name: Check an endpoint
    retry:
      attempts: 3
      delay_seconds: 2
      backoff: 2
    timeout_seconds: 10
    http:
      url: https://example.com
      method: GET
      expect_status: [200]
    save_as: response

  - id: local-summary
    name: Use a local model
    needs: [status]
    if: git_status != ""
    timeout_seconds: 120
    ollama:
      model: qwen3:8b
      prompt: "Summarize: {{git_status}}"
    save_as: summary

  - id: finished
    needs: [endpoint]
    notify:
      title: Finished
      message: Workflow completed
```

## Security model

A DeskCron workflow can execute shell commands with your user permissions. Review workflow files before running them, the same way you would review a shell script or CI workflow.

DeskCron has no hosted control plane. See [SECURITY.md](SECURITY.md).

## Project status

DeskCron is in Public Preview. The workflow schema is still version `1`, and v0.1/v0.2 workflows remain compatible. Until `1.0.0`, small CLI or schema details may evolve between minor releases.

## Development

```bash
npm install
npm run check
npm run dev -- --help
```

## Roadmap

- file-watch and Git-event triggers
- encrypted local secrets
- background service installers for Windows, macOS and Linux
- optional desktop tray UI
- richer history inspection
- community recipe catalog

## Contributing

Issues and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
