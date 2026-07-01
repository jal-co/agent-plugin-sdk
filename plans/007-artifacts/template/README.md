# ap-sdk plugin template

Use this template to publish an agent plugin that consumers can install from GitHub:

```bash
npx ap-sdk install <owner>/<repo>
```

## Develop

```bash
pnpm install
pnpm check
pnpm build
pnpm install-local
```

Tag the repository with the `ap-sdk-plugin` GitHub topic so it appears in the plugin directory.

Built with [ap-sdk](https://ap-sdk.dev/docs).
