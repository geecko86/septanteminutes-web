# Contributing

Thank you for your interest in contributing to septanteminutes.be.

## Prerequisites

- **Node 22** — use [nvm](https://github.com/nvm-sh/nvm): `nvm use` (`.nvmrc` is present at repo root)
- **Yarn 1** — `npm install -g yarn`

## Setup

```bash
cp .env.example .env   # copy env template; set EPISODES_COUNT to current episode count
yarn install           # install dependencies
yarn dev               # start dev server at http://localhost:3000
```

## Before submitting a PR

Run the following locally and make sure all three pass:

```bash
yarn lint    # ESLint via next lint
yarn test    # Vitest unit tests
yarn build   # static export — catches type errors and build-time failures
```

Do not open a PR if any of these commands fail.

## PR conventions

- Branch from `main`.
- Use descriptive commit messages (e.g. `fix(player): correct seek bar thumb position on mobile`).
- Link any related GitHub issue in the PR description.
- Keep PRs focused — one concern per PR makes review faster.

## Questions

Open a GitHub issue or email [contact@septanteminutes.be](mailto:contact@septanteminutes.be).
