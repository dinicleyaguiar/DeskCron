# Security

DeskCron intentionally executes commands defined in local workflow files. Treat workflow files as executable code.

## Trust model

- Do not run workflows from untrusted repositories without reviewing them.
- Keep secrets in environment variables; do not commit them to YAML files.
- HTTP, shell and Ollama steps run with the permissions of the current user.
- DeskCron does not upload workflows, logs or prompts to a DeskCron service.
- Ollama steps communicate only with the configured Ollama endpoint.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature when available. Avoid publishing exploitable details in a public issue before a fix is available.
