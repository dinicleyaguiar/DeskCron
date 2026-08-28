# Changelog

All notable changes to DeskCron are documented here.

## 0.3.0 - Public Preview

- prepare DeskCron for its first public repository release
- add repository, homepage, issue tracker and author metadata to the npm package
- add a build `prepare` hook so installs directly from GitHub compile the CLI automatically
- add `prepack` verification for release artifacts
- add GitHub tag release automation with checksums
- add Dependabot configuration for npm and GitHub Actions
- add a pull request template
- strengthen public installation and project-status documentation
- keep workflow schema version 1 compatible with v0.1 and v0.2 workflows

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
