// `server-only` throws at module-load time outside Server Components.
// In standalone scripts (smoke test, migration) that boundary doesn't
// exist — register a require alias that resolves the package to a no-op
// BEFORE we import any modules that pull it in.
import { Module } from "node:module";
type ResolveFn = (...args: unknown[]) => string;
const orig = (Module as unknown as { _resolveFilename: ResolveFn })._resolveFilename;
(Module as unknown as { _resolveFilename: ResolveFn })._resolveFilename = function (...args) {
  if (args[0] === "server-only") {
    return require.resolve("./_serverOnlyNoop.js");
  }
  return orig.apply(this, args);
};
