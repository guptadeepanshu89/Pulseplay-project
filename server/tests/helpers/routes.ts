import type { Express } from 'express';

// Every "METHOD /full/path" the app really serves, read from Express's own
// router stack (so a route added anywhere shows up here without anyone
// remembering to list it).

interface Layer {
  name: string;
  regexp: RegExp;
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: Layer[] };
}

// A mounted router's layer only keeps a regexp such as /^\/api\/v1\/admin\/?(?=\/|$)/ — turn it back into "/api/v1/admin".
const mountPath = (layer: Layer) => layer.regexp.source.replace('^', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');

function collect(stack: Layer[], prefix: string, out: string[]) {
  for (const layer of stack) {
    if (layer.route) {
      const path = `${prefix}${layer.route.path}`.replace(/\/$/, '') || '/';
      for (const method of Object.keys(layer.route.methods)) out.push(`${method.toUpperCase()} ${path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      collect(layer.handle.stack, `${prefix}${mountPath(layer)}`, out);
    }
  }
}

export function listRoutes(app: Express): string[] {
  const routes: string[] = [];
  collect((app as unknown as { _router: { stack: Layer[] } })._router.stack, '', routes);
  return routes.sort();
}
