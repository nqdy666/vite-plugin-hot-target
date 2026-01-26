import './style.css'

document.querySelector('#app').innerHTML = `
  <h1>Hello Vite!</h1>
  <a href="https://vitejs.dev/guide/features.html" target="_blank">Documentation</a>
`

fetch('/api/example').then(res => res.text()).then((res) => {
  console.log(res)
})

// const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
// const host = window.location.host // 包含端口（如果有）
// const path = '/websocket' // 你的 WebSocket 路径
// const socket = new WebSocket(`${protocol}://${host}${path}`)
// socket.onopen = function () {
//   socket.send('Hello Server!')
// }
