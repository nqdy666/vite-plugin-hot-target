import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import micromatch from 'micromatch'

export interface VitePluginHotTargetOptions {
  /**
   * 是否启用
   * @default true
   */
  enable?: boolean
  /**
   * 是否打印日志
   * @default true
   */
  log?: boolean
  /**
   * target的值为空的时候是否触发
   * @default false
   */
  emptyChange?: boolean
  /**
   * target的值为空的时候的默认值
   * @default false
   */
  targetWhenEmpty?: string
  /**
   * 需要监听的target文件
   */
  targetFile?: string
  /**
   * hotTarget前缀
   */
  hotTargetPrefix?: string
  /**
   * ws目前支持不完全，开启后可以监听websocket的连接，需要二次请求才会生效
   */
  wsEnable?: boolean
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
  [key: string]: string
}

function VitePluginHotTarget(options: VitePluginHotTargetOptions = {}): Plugin {
  const {
    enable = true,
    emptyChange = false,
    targetWhenEmpty = 'https://127.0.0.1',
    log = true,
    targetFile = '',
    hotTargetPrefix = 'hotTargetPlugin:',
    wsEnable = false,
  } = options

  let root = process.cwd()
  let targetGlobs: string[] = []

  // let targetFileChange = false
  const targetMap: Record<string, string> = {}
  const fileChangeForContenxt: Record<string, boolean> = {}

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
    name: `vite-plugin-hot-target:${i++}`,
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
        const targetConfigInfo = getTargetInfo()
        const defaultTarget = targetConfigInfo.default

        const proxyOptions = config.server.proxy || {}
        Object.keys(proxyOptions).forEach((context) => {
          let opts = proxyOptions[context] || {}
          if (typeof opts === 'string') {
            opts = { target: opts, changeOrigin: true }
          }
          // @ts-nocheck
          if (opts && ((opts as any).useVitePluginHotTarget || !opts.target || opts.target.toString().startsWith(hotTargetPrefix))) {
            const originConfigure = opts.configure

            let targetKey = ''

            if (!opts.target) {
              opts.target = defaultTarget || targetWhenEmpty
              targetKey = 'default'
              targetMap[targetKey] = defaultTarget
            }
            else if (opts.target.toString().startsWith(hotTargetPrefix)) {
              targetKey = opts.target.toString().replace(hotTargetPrefix, '')
              if (targetKey) {
                opts.target = targetConfigInfo[targetKey] || targetWhenEmpty
                targetMap[targetKey] = targetConfigInfo[targetKey]
              }
            }

            if (targetKey) {
              opts.configure = (proxy, options) => {
                if (log) {
                  console.log(`target[${context}]`, targetMap[targetKey])
                }

                function updateOptionsTarget(option: any) {
                  if (!fileChangeForContenxt[context]) {
                    fileChangeForContenxt[context] = true
                    const data = getTargetInfo()
                    const targetTmp = data[targetKey]
                    if (targetTmp || (!targetTmp && emptyChange)) {
                      if (targetTmp !== targetMap[targetKey]) {
                        const urlInfo = new URL(targetTmp || targetWhenEmpty)
                        Object.assign(option, {protocol:urlInfo.protocol,host:urlInfo.host,hostname:urlInfo.hostname,port:urlInfo.port,pathname:urlInfo.pathname,search:urlInfo.search,href:urlInfo.href})
                        options.target = targetTmp || targetWhenEmpty
                        targetMap[targetKey] = targetTmp
                        if (log) {
                          console.log(`target changed[${context}]`, targetMap[targetKey])
                        }
                      }
                    }
                  }
                }
                // https://github.com/sagemathinc/http-proxy-3/blob/main/lib/http-proxy/passes/web-incoming.ts
                // 具体参考这里发出来的事件
                proxy.on('start', (req, res, option) => {
                  updateOptionsTarget(option)
                })
                if (opts.ws && wsEnable) {
                  // https://github.com/sagemathinc/http-proxy-3/blob/main/lib/http-proxy/passes/ws-incoming.ts
                  // 这里没有在 common.setupOutgoing和proto.request 前暴露修改option的能力
                  proxy.on('proxyReqWs', (proxyReq, req, socket, option) => {
                    updateOptionsTarget(option)
                  })
                }
                if (typeof originConfigure === 'function') {
                  return originConfigure(proxy, options)
                }
              }
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
            // targetFileChange = true
            Object.keys(fileChangeForContenxt).forEach((key) => {
              fileChangeForContenxt[key] = false
            })
          }
        }
      }
    },
  }
}

export default VitePluginHotTarget
