/**
 * dsh-cost-pill — host entry.
 *
 * The visible half of this plugin is the browser bundle (`lib/client.js`), which
 * the web host serves because `package.json` declares `dsh.client`. The host half
 * owns no service and touches no file: it exists so the roster row that
 * `cordis.patch.yml` inserts has an entry to activate.
 */

/** Roster identity; must match the package name. */
export const name = "dsh-cost-pill";

/** Nothing to mount on the host side. */
export function apply() {}
