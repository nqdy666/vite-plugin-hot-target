<h2 align='center'><samp>vite-plugin-hot-target</samp></h2>

<p align='center'>Hot update target without restarting Vite</p>

<p align='center'>
<a href='https://www.npmjs.com/package/vite-plugin-hot-target'>
<img src='https://img.shields.io/npm/v/vite-plugin-hot-target?color=222&style=flat-square'>
</a>
</p>

<br>

## Usage

Install

```bash
npm i vite-plugin-hot-target -D # yarn add vite-plugin-hot-target -D
```

Add it to `vite.config.js`

```ts
// vite.config.js
import ViteHotTarget from 'vite-plugin-hot-target'

export default {
  plugins: [
    ViteHotTarget({
      restart: [
        'target.[jt]s',
      ]
    })
  ],
}
```

Changes to `target.js` or `target.ts` will now restart the proxy without restarting Vite.

## License

MIT License © 2025 [nianqin](https://github.com/nqdy666)
