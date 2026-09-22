import type { AuthenticatedPrincipal } from './authenticated-principal.js';

/**
 * Authentication-to-authorization seam.
 *
 * Authentication infrastructure supplies an HTTP request/context and this
 * contract resolves the canonical principal consumed by authorization.
 *
 * The resolver does not authenticate anything by itself.
 */
export interface PrincipalResolver {
  resolve(request: unknown): AuthenticatedPrincipal | null;
}
