/**
 * dsh-cost-pill — host entry.
 *
 * The visible half of this plugin is the browser bundle (`lib/client.js`), which
 * the web host serves because `package.json` declares `dsh.client`. The host half
 * owns no services and touches no files: it exists so the roster row that
 * `cordis.patch.yml` inserts loads cleanly.
 */

/** Roster identity; must match the package name. */
export const name = "dsh-cost-pill";

/** No host service is required before `apply` runs. */
export const inject = [];

/** Nothing to mount on the host side. */
export function apply() {}
