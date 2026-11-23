
# Gurusthalam Design System

Official shared visual foundation for the Gurusthalam
Education Intelligence Platform.

## Purpose

Provide a consistent, accessible, responsive and scalable
visual language across all Gurusthalam applications.

## Architecture

### tokens/

Centralized design decisions.

- colors.css
- spacing.css
- typography.css

### themes/

Theme-specific semantic variables.

- light.css
- dark.css

### foundations/

Global browser and accessibility foundations.

- reset.css
- accessibility.css

### typography/

Typography hierarchy and text utilities.

### components/

Shared visual component primitives.

React component implementations belong in libs/ui/.

## Applications

The design system is shared by:

- apps/web
- apps/admin

Future applications must consume the same foundations.

## Brand direction

- Deep navy identity
- Enterprise blue primary color
- Teal accent
- Neutral light surfaces
- Consistent semantic status colors

## Technical rules

1. CSS-only browser-safe implementation.
2. No React dependency.
3. No NestJS dependency.
4. No Prisma dependency.
5. No backend domain imports.
6. No server secrets or environment access.
7. No application-specific business logic.
8. No duplicated global design tokens.

## Naming convention

All shared CSS classes use the gt- prefix.

Examples:

- gt-button
- gt-card
- gt-badge
- gt-input
- gt-container
- gt-page-header

## Theme contract

Light theme is the default.

Dark theme is activated through:

data-theme="dark"

Theme persistence and user-facing theme switching
will be implemented in the application providers.

## Accessibility

Target WCAG 2.2 AA.

Support:

- Keyboard navigation
- Visible focus
- Reduced motion
- Semantic HTML
- Responsive text
- Readable contrast

## Change management

Changes to design tokens must be evaluated against
both Web and Admin applications.

Breaking changes require explicit review.
