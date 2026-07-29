# rollup-plugin-thunder

A [rollup](https://rollupjs.org/) plugin to transform CSS with [lightningcss](https://lightningcss.dev/).

## Install

```sh
npm install -D rollup-plugin-thunder
```

## Usage

```js
// rollup.config.mjs
import thunder from "rollup-plugin-thunder";

export default {
  input: "src/index.ts",
  output: { file: "dist/bundle.js", format: "es" },
  plugins: [thunder()],
};
```

### Options

| Option         | Type       | Default | Description                                      |
| -------------- | ---------- | ------- | ------------------------------------------------ |
| `include`      | `string[]` | —       | Files to include (picomatch patterns)             |
| `exclude`      | `string[]` | —       | Files to exclude (picomatch patterns)             |
| `options`      | `object`   | —       | [lightningcss transform options](https://lightningcss.dev/docs.html) |
| `styleSheet`   | `boolean`  | `false` | Emit `CSSStyleSheet` instead of raw CSS string    |
| `autoModules`  | `boolean`  | `false` | Enable CSS modules for `*.module.css` files       |

## License

MIT