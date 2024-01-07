import type { Plugin, ModuleInfo as BaseModuleInfo } from "rollup";
import { createFilter, FilterPattern } from "@rollup/pluginutils";
import {
  bundleAsync,
  browserslistToTargets,
  CustomAtRules,
  TransformOptions,
} from "lightningcss";
import browserslist from "browserslist";
import resolve, { ResolveOptionsOptionalFS } from "enhanced-resolve";
import path from "path";
import fs from "fs/promises";

export type LightningOptions = Omit<
  TransformOptions<CustomAtRules>,
  "filename" | "code"
>;

export interface Options {
  include?: FilterPattern;
  exclude?: FilterPattern;
  options?: LightningOptions;
  styleSheet?: boolean;
  autoModules?: boolean;
}

interface ModuleInfo extends BaseModuleInfo {
  assertions: { type: string };
}

const resolveAsync = (options?: ResolveOptionsOptionalFS) => {
  const resolver = resolve.create({
    ...options,
    extensions: options?.extensions ?? [".css"],
  });
  return (specifier: string, from: string) =>
    new Promise<string>((resolve, reject) =>
      resolver(from, specifier, (err, resolved) => {
        if (err || !resolved)
          return reject(`Failed to resolve import: ${from} ${err}`);
        return resolve(resolved);
      }),
    );
};

const resolveRelative = (specifier: string, from: string) => {
  const rel = path.resolve(path.dirname(from), specifier);
  return fs.lstat(rel).then(() => rel);
};

const dashesCamelCase = (str: string) => {
  return str.replace(/-+(\w)/g, (_, firstLetter) => firstLetter.toUpperCase());
};

export default function thunder(input: Options = {}): Plugin {
  const filter = createFilter(input.include, input.exclude);
  const modulesFilter = createFilter(["**/*.module.css"]);
  const opts = { ...input.options };
  if (!("targets" in opts))
    opts["targets"] = browserslistToTargets(browserslist());
  const resolver = resolveAsync();
  return {
    name: "thunder",
    async load(id: string) {
      if (!filter(id)) return null;
      const options = {
        ...opts,
        cssModules: opts.cssModules ?? (input.autoModules && modulesFilter(id)),
        filename: id,
        resolver: {
          resolve: (specifier: string, from: string) =>
            resolveRelative(specifier, from)
              .catch(() => resolveRelative(`${specifier}.css`, from))
              .catch(() => resolver(specifier, from)),
        },
      };
      const res = await bundleAsync(options);
      const map = "map" in res ? res.map?.toString() : undefined;
      const rawCode = JSON.stringify(res.code.toString());
      const moduleInfo = this.getModuleInfo(id) as ModuleInfo;

      let code =
        input.styleSheet ||
        moduleInfo.attributes?.type == "css" ||
        moduleInfo?.assertions?.type == "css"
          ? `const sheet = new CSSStyleSheet();sheet.replaceSync(${rawCode});export default sheet;`
          : `export default ${rawCode};`;

      if (options.cssModules) {
        code += "let classes = {};";
        code += Object.entries(res.exports ?? {})
          .map(
            ([key, exp]) =>
              `classes["${dashesCamelCase(key)}"] = ${JSON.stringify(
                [exp.name, ...exp.composes.map(({ name }) => name)].join(" "),
              )};`,
          )
          .join("");
        code += `export { classes, classes as C };`;
      }

      return {
        code,
        map,
      };
    },
  };
}
