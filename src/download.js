import fs from 'node:fs'
import path from 'node:path'
import WebTorrent from 'webtorrent'
import { View } from './progress.js'
import { c, fmtBytes, fmtSpeed, fmtEta, bar, truncate, globToRegExp } from './format.js'

const MEDIA_RE = /\.(mp4|m4v|webm|mkv|mov|ogv|mp3|flac|wav|m4a|aac|opus|oga)$/i
const MAX_LISTED_FILES = 30

export async function run (opts) {
  const view = new View({ quiet: opts.quiet })
  const dir = path.resolve(opts.dir)
  fs.mkdirSync(dir, { recursive: true })

  const client = new WebTorrent({ maxConns: 100 })
  let server = null
  let timer = null
  let torrent = null
  let selected = null
  let finished = false
  let shuttingDown = false

  function shutdown (code) {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(timer)
    view.end()
    try { server?.close() } catch {}
    const killTimer = setTimeout(() => process.exit(code), 3000)
    killTimer.unref?.()
    try {
      client.destroy(() => {
        clearTimeout(killTimer)
        process.exit(code)
      })
    } catch {
      process.exit(code)
    }
  }

  process.on('SIGINT', () => {
    if (shuttingDown) process.exit(130)
    view.print(c.dim('Останавливаю… (повторный Ctrl+C — принудительный выход)'))
    shutdown(0)
  })
  process.on('SIGTERM', () => shutdown(0))

  // Локальный HTTP-сервер: отдаёт файлы с поддержкой Range-запросов.
  server = client.createServer({ hostname: '127.0.0.1' })
  try {
    await new Promise((resolve, reject) => {
      server.server.once('error', reject)
      server.server.listen(opts.port || 0, '127.0.0.1', resolve)
    })
  } catch (err) {
    console.error(c.red(`Не удалось запустить стриминг-сервер: ${err.message}`))
    process.exit(1)
  }
  const port = server.server.address().port

  view.print(`${c.dim('Торрент:')} ${truncate(opts.torrentId, 100)}`)
  view.print(`${c.dim('Папка:')}   ${dir}`)

  try {
    torrent = client.add(opts.torrentId, { path: dir })
  } catch (err) {
    console.error(c.red(`Не удалось добавить торрент: ${err.message}`))
    process.exit(1)
  }

  torrent.on('warning', err => view.print(c.yellow(`! ${err.message}`)))

  torrent.on('error', err => {
    view.end()
    console.error(c.red(`Ошибка торрента: ${err.message}`))
    shutdown(1)
  })

  client.on('error', err => {
    view.end()
    console.error(c.red(`Ошибка клиента: ${err.message}`))
    shutdown(1)
  })

  torrent.on('ready', () => {
    selected = new Set(torrent.files.map((_, index) => index))

    if (opts.only) {
      const pattern = globToRegExp(opts.only)
      selected = new Set()
      torrent.files.forEach((file, index) => {
        const filePath = String(file.path).replace(/\\/g, '/')
        const match = pattern.test(filePath) || pattern.test(file.name)
        if (match) selected.add(index)
      })

      if (selected.size === 0) {
        view.end()
        console.error(c.red(`Ни один файл не подходит под «${opts.only}»`))
        shutdown(1)
        return
      }

      // Сбрасываем выбор целиком и заново выбираем нужные файлы: куски на
      // границах файлов общие, и простой deselect соседей «съедает» их.
      torrent.files.forEach(file => file.deselect())
      for (const index of selected) torrent.files[index].select()
    }

    view.end()
    const total = torrent.files.reduce((sum, file) => sum + file.length, 0)
    view.print(`${c.bold(torrent.name)}  ${c.dim(`— ${fmtBytes(total)}, файлов: ${torrent.files.length}`)}`)
    view.print(`${c.dim('Папка:')} ${dir}`)
    if (torrent.magnetURI) view.print(`${c.dim('Magnet:')} ${torrent.magnetURI}`)

    const listed = torrent.files.slice(0, MAX_LISTED_FILES)
    torrent.files.forEach((file, index) => {
      if (index >= MAX_LISTED_FILES) return
      const isSelected = selected.has(index)
      const line = `  ${isSelected ? '·' : c.dim('×')} ${isSelected ? file.path : c.dim(file.path)}  ${c.dim(fmtBytes(file.length))}`
      view.print(line)
    })
    if (torrent.files.length > listed.length) {
      view.print(c.dim(`  … ещё ${torrent.files.length - listed.length} файл(ов)`))
    }

    const media = torrent.files.filter((file, index) => selected.has(index) && MEDIA_RE.test(file.name))
    if (media.length) {
      view.print(`${c.dim('Стриминг:')} http://127.0.0.1:${port}/webtorrent/${torrent.infoHash}/`)
      for (const file of media.slice(0, 10)) {
        view.print(`  ${c.cyan(`http://127.0.0.1:${port}${file.streamURL}`)}`)
      }
      if (media.length > 10) view.print(c.dim(`  … ещё ${media.length - 10} медиафайл(ов)`))
    }

    view.print('')
  })

  function computeStats () {
    if (!torrent || !torrent.ready) return null
    let total = 0
    let done = 0
    torrent.files.forEach((file, index) => {
      if (selected && !selected.has(index)) return
      total += file.length
      done += file.downloaded
    })
    return { total, done, progress: total > 0 ? Math.min(1, done / total) : 1 }
  }

  function etaText (stats) {
    const speed = torrent.downloadSpeed
    if (!speed || stats.progress >= 1) return '—'
    return fmtEta(((stats.total - stats.done) / speed) * 1000)
  }

  function progressLine (stats) {
    const width = view.tty ? Math.max(72, Math.min(view.stream.columns || 110, 160)) : 110
    const nameWidth = Math.max(14, Math.min(40, width - 92))
    const percent = `${(stats.progress * 100).toFixed(1)}%`.padStart(6)
    const speeds = `${c.green('↓')} ${fmtSpeed(torrent.downloadSpeed)}  ${c.cyan('↑')} ${fmtSpeed(torrent.uploadSpeed)}`
    const peers = `${torrent.numPeers} пир.`
    const tail = stats.progress >= 1
      ? c.green('раздача')
      : `${c.dim('осталось')} ${etaText(stats)}`

    return [
      c.bold(truncate(torrent.name, nameWidth).padEnd(nameWidth)),
      c.green(bar(stats.progress, 20)),
      c.bold(percent),
      `${fmtBytes(stats.done)}/${fmtBytes(stats.total)}`,
      speeds,
      peers,
      tail
    ].join('  ')
  }

  function complete (stats) {
    if (finished) return
    finished = true
    view.end()
    view.print(`${c.green('✔')} Загрузка завершена: ${torrent.name} — ${fmtBytes(stats.total)}`)
    if (opts.exitWhenDone) {
      shutdown(0)
      return
    }
    view.print(c.dim('Раздаю торрент. Ctrl+C — выйти.'))
    view.print('')
  }

  function tick () {
    if (shuttingDown) return

    if (!torrent || !torrent.ready) {
      const text = `${c.dim('Ожидание метаданных…')}  пиров: ${torrent?.numPeers ?? 0}`
      view.draw(text)
      view.drawPlain(text.replace(/\x1b\[[0-9;]*m/g, ''))
      return
    }

    const stats = computeStats()
    const text = progressLine(stats)
    view.draw(text)
    view.drawPlain(text.replace(/\x1b\[[0-9;]*m/g, ''))

    if (!finished && stats.progress >= 1) complete(stats)
  }

  timer = setInterval(tick, view.tty ? 400 : 1000)
  tick()
}
