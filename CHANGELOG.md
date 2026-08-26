# Changelog

## 0.2.0

- add `deskcron run --dry-run`
- add local JSONL run history and `deskcron history`
- add step retries with delay and backoff
- add top-level step timeouts
- add safe `if` conditions
- add `needs` dependencies between steps
- add improved structured terminal logging
- add bundled workflow recipes and recipe copy commands
- improve command timeout handling on Windows
- keep workflow schema version 1 backwards compatible with v0.1 workflows

## 0.1.0

- initial CLI
- startup and cron triggers
- shell, HTTP, Ollama and notification steps
- template variables and environment variables
- workflow validation and overlap protection
