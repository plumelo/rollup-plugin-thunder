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

export default function thunder(input: Options = {}): Plugin {
  const filter = createFilter(input.include, input.exclude);
  const { options = {} as LightningOptions } = input;
  if (!("targets" in options))
    options["targets"] = browserslistToTargets(browserslist());
  return {
    name: "thunder",
    async load(id: string) {
      if (!filter(id)) return null;
      const res = await bundleAsync({
        ...options,
        filename: id,
        resolver: {
          resolve(specifier: string, from: string) {
            const rel = path.resolve(path.dirname(from), specifier);
            return fs.lstat(rel).then(
              () => rel,
              () => resolveAsync(specifier),
            );
          },
        },
      });
      const map = "map" in res ? res.map?.toString() : undefined;

      if ("cssModules" in options) {
        const klass = Object.fromEntries(
          Object.entries(res.exports ?? {}).map(([key, exp]) => [
            key,
            [exp.name, ...exp.composes.map(({ name }) => name)].join(" "),
          ]),
        );
        return {
          code: `
            export const css = ${JSON.stringify(res.code.toString())}
            export default ${JSON.stringify(klass)}
          `,
          map,
        };
      }

      return {
        code: res.code.toString(),
        map,
      };
    },
  };
}
