# Contributing

Thanks for helping improve DeskCron.

## Development

```bash
npm install
npm run check
npm run dev -- --help
```

## Pull requests

Keep pull requests focused. New workflow features should include:

- schema validation
- tests
- documentation
- at least one recipe or example when the feature benefits from one

For behavior changes, describe the user-visible effect and any security implications.

## Recipes

Recipes belong in `recipes/` and should:

- solve one clear problem
- avoid embedded credentials
- use environment variables for secrets
- use portable commands when practical
- have a short description
- be safe to review in under a minute
