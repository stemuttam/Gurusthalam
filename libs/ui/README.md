# @gurusthalam/ui

The shared React component library for Gurusthalam Web and Admin applications.

## Package contract

- Package name: `@gurusthalam/ui`
- Module format: ESM
- Public entry point: `dist/index.js`
- Type declarations: `dist/index.d.ts`
- React: peer dependency
- Source entry point: `src/index.ts`

Applications should consume components through the package root:

```tsx
import { Alert, Badge, Button, Card, PageHeader } from '@gurusthalam/ui';
```

Do not import components through relative paths into `libs/ui/src`.

## Design-system styles

The component library uses the Gurusthalam design-system CSS classes and tokens.

Applications must load the shared design-system stylesheet once.

The Web and Admin applications currently do this through:

```css
@import '../../../libs/design-system/src/index.css';
```

Their `index.html` files load their respective `src/styles.css` files.

Do not add a second import of the design-system stylesheet to individual pages or components.

## Workspace dependencies

The Web and Admin applications declare the library using:

```json
{
  "dependencies": {
    "@gurusthalam/ui": "workspace:*"
  }
}
```

The package manager resolves this dependency to the local `libs/ui` workspace package.

## Build and validation

From the workspace root:

```bash
pnpm install --lockfile-only
pnpm install

pnpm exec nx build @gurusthalam/ui
pnpm exec nx test @gurusthalam/ui

pnpm exec nx run-many -t typecheck lint test build \
  --projects @gurusthalam/ui @org/web @org/admin \
  --skip-nx-cache
```

The Nx build dependency graph should build workspace dependencies before consuming application builds.

## Public API policy

- Export public components and their public prop types from category entry points.
- Re-export categories through `src/index.ts`.
- Do not expose internal implementation utilities unless they are intentionally part of the supported API.
- Add a public API regression test when adding or removing exported components.
- Keep component styling in the shared design system.
- Keep application-specific layout and page behavior inside the consuming application.

## Integration boundary

The Web and Admin integration previews verify that both applications can consume the shared UI package.

They are not substitutes for the later learner, teacher, institution administration, authentication or platform operations features.
