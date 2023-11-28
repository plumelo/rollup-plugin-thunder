import type { Plugin } from "rollup";
import { createFilter, FilterPattern } from "@rollup/pluginutils";
import {
  bundleAsync,
  browserslistToTargets,
  CustomAtRules,
  TransformOptions,
} from "lightningcss";
import browserslist from "browserslist";
import resolve, { AsyncOpts } from "resolve";
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
  autoModules?: boolean;
}

const resolveAsync = async (
  id: string,
  options: AsyncOpts = {},
): Promise<string> =>
  new Promise((solve, reject) =>
    resolve(
      id,
      {
        ...options,
        preserveSymlinks: true,
        extensions: options.extensions ?? [".css"],
      },
      (err, resolved) => {
        if (err || !resolved)
          return reject(`Failed to resolve import: ${id} ${err}`);
        return solve(resolved);
      },
    ),
  );

const resolveRelative = (specifier: string, from: string) => {
  const rel = path.resolve(path.dirname(from), specifier);
  return fs.lstat(rel).then(() => rel);
};

export default function thunder(input: Options = {}): Plugin {
  const filter = createFilter(input.include, input.exclude);
  const modulesFilter = createFilter(["**/*.module.css"]);
  const { options = {} as LightningOptions } = input;
  if (!("targets" in options))
    options["targets"] = browserslistToTargets(browserslist());
  return {
    name: "thunder",
    async load(id: string) {
      if (!filter(id)) return null;
      if (!options.cssModules && input.autoModules && modulesFilter(id)) {
        options.cssModules = true;
      }
      const res = await bundleAsync({
        ...options,
        filename: id,
        resolver: {
          resolve: (specifier: string, from: string) =>
            resolveRelative(specifier, from)
              .catch(() => resolveRelative(`${specifier}.css`, from))
              .catch(() => resolveAsync(specifier)),
        },
      });
      const map = "map" in res ? res.map?.toString() : undefined;
      let code = `export default ${JSON.stringify(res.code.toString())};`;

      if ("cssModules" in options) {
        code += Object.entries(res.exports ?? {})
          .map(
            ([key, exp]) =>
              `export const ${key} = ${JSON.stringify(
                [exp.name, ...exp.composes.map(({ name }) => name)].join(" "),
              )};`,
          )
          .join("");
      }

      return {
        code,
        map,
      };
    },
  };
}
