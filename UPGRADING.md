# Upgrading DeskCron

## 0.2 to 0.3

Workflow schema version `1` is unchanged. Existing v0.1 and v0.2 workflow files remain valid.

From a source checkout:

```bash
git pull
npm install
npm run check
npm link
```

The v0.3 release adds package/release infrastructure but does not require workflow changes.

## 0.1 to 0.2

Workflow schema version `1` is preserved. Existing v0.1 workflow files remain valid.

After replacing the source files, run:

```bash
npm install
npm run check
npm link
```

New optional step fields in v0.2:

```yaml
id: tests
if: success()
needs: [prepare]
timeout_seconds: 120
retry:
  attempts: 3
  delay_seconds: 2
  backoff: 2
```

Run history is stored under `.deskcron/history/` and is ignored by Git.
