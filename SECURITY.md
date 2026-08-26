# Security

DeskCron intentionally executes commands defined in local workflow files. Treat workflow files as executable code.

## Trust model

- Do not run workflows from untrusted repositories without reviewing them.
- Keep secrets in environment variables; do not commit them to YAML files.
- HTTP, shell and Ollama steps run with the permissions of the current user.
- `if` conditions use a deliberately limited parser and do not evaluate JavaScript.
- Run history is local and ignored by Git, but compact error strings may contain information emitted by failed tools.
- DeskCron does not upload workflows, logs, prompts or history to a DeskCron service.
- Ollama steps communicate only with the configured Ollama endpoint.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting when available. Avoid publishing exploitable details in a public issue before a fix is available.
