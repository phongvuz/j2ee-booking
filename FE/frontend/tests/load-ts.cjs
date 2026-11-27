const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Load TypeScript with mocked dependencies, without connecting to the database.
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const modulePath = id.startsWith("@/")
        ? path.resolve(__dirname, "..", id.slice(2))
        : path.resolve(path.dirname(filename), id);
      const file = [modulePath + ".ts", modulePath + ".tsx", modulePath + "/index.ts"]
        .find((candidate) => fs.existsSync(candidate));
      if (file) return load(file, mocks, cache);
    }
    return original(id);
  };
  mod._compile(compiled, filename);
  return mod.exports;
}

module.exports = { load };
