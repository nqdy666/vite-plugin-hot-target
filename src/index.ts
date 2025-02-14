import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'
import vm from 'node:vm'
import micromatch from 'micromatch'

export interface VitePluginHotTargetOptions {
  /**
   * 是否启用
   * @default true
   */
  enable?: boolean
  /**
   * 是否启用
   * @default true
   */
  log?: boolean
  /**
   * target的值为空的时候是否触发
   * @default false
   */
  emptyChange?: boolean
  /**
   * target的值为空的时候是否触发
   * @default false
   */
  targetWhenEmpty?: string
  /**
   * Array of files to watch
   */
  targetFile?: string | string[]
}

let i = 0

// 将传入的参数转换为数组类型
function toArray<T>(arr: T | T[] | undefined): T[] {
  // 如果传入的参数为空，则返回空数组
  if (!arr)
    return []
  // 如果传入的参数是数组类型，则直接返回该数组
  if (Array.isArray(arr))
    return arr
  // 如果传入的参数不是数组类型，则将其转换为数组并返回
  return [arr]
}

interface TARGET_OPTION {
  default: string
}

function VitePluginHotTarget(options: VitePluginHotTargetOptions = {}): Plugin {
  const {
    enable = true,
    emptyChange = false,
    targetWhenEmpty = 'https://127.0.0.1',
    log = true,
    targetFile = '',
  } = options

  let root = process.cwd()
  let targetGlobs: string[] = []

  let targetFileChange = false
  let target: string = ''

  function getTargetInfo(): TARGET_OPTION {
    if (!targetGlobs[0]) {
      return { default: '' }
    }
    const filePath = targetGlobs[0]
    if (!fs.existsSync(filePath)) {
      return { default: '' }
    }
    let fileContent = fs.readFileSync(filePath, 'utf8')
    fileContent = fileContent.replace(/export default/g, 'module.exports.default =')
    fileContent = fileContent.replace(/export const\s*/g, 'exports.')

    const module = { exports: {} }

    try {
      const script = new vm.Script(fileContent)
      const require = (modulePath: string) => {
        return require(modulePath)
      }
      script.runInNewContext({ module, exports: module.exports, require })
    }
    catch (e) {
      console.error(e)
    }

    const options = module.exports as TARGET_OPTION
    return options
  }

  return {
    name: `vite-plugin-target:${i++}`,
    apply: 'serve',
    config(c) {
      if (!enable)
        return
      if (!c.server)
        c.server = {}
      if (!c.server.watch)
        c.server.watch = {}
      c.server.watch.disableGlobbing = false
    },
    configResolved(config) {
      if (enable) {
        // famous last words, but this *appears* to always be an absolute path
        // with all slashes normalized to forward slashes `/`. this is compatible
        // with path.posix.join, so we can use it to make an absolute path glob
        root = config.root

        targetGlobs = toArray(targetFile).map(i => path.posix.join(root, i))
        // console.log('targetGlobs', config.server.proxy)
        const defaultTarget = getTargetInfo().default

        const proxyOptions = config.server.proxy || {}
        Object.keys(proxyOptions).forEach((context) => {
          let opts = proxyOptions[context] || {}
          if (typeof opts === 'string') {
            opts = { target: opts, changeOrigin: true }
          }
          // @ts-nocheck
          if (opts && ((opts as any).useVitePluginHotTarget || !opts.target)) {
            const originConfigure = opts.configure
            opts.target = defaultTarget || targetWhenEmpty
            target = defaultTarget
            opts.configure = (proxy, options) => {
              if (log) {
                console.log(`target[${context}]`, defaultTarget)
              }
              proxy.on('start', (req, res, t) => {
                if (targetFileChange) {
                  targetFileChange = false
                  const data = getTargetInfo()
                  const targetTmp = data.default
                  if (targetTmp || (!targetTmp && emptyChange)) {
                    if (targetTmp !== target) {
                      const urlInfo = url.parse(targetTmp || targetWhenEmpty)
                      Object.assign(t, urlInfo)
                      options.target = targetTmp || targetWhenEmpty
                      target = targetTmp
                      if (log) {
                        console.log(`target changed[${context}]`, target)
                      }
                    }
                  }
                }
                if (typeof originConfigure === 'function') {
                  return originConfigure(proxy, options)
                }
              })
            }
          }
        })
      }
    },
    configureServer(server) {
      if (enable) {
        server.watcher.add([
          ...targetGlobs,
        ])
        server.watcher.on('add', handleFileChange)
        server.watcher.on('change', handleFileChange)
        server.watcher.on('unlink', handleFileChange)

        function handleFileChange(file: string) {
          if (micromatch.isMatch(file, targetGlobs)) {
            // if (log) {
            //   console.log(`target file change`, file)
            // }
            targetFileChange = true
          }
        }
      }
    },
  }
}

export default VitePluginHotTarget
