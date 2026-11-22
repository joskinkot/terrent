export const USAGE = `
terrent — торрент-клиент для терминала

Использование:
  terrent <торрент> [опции]

  <торрент>   magnet-ссылка, путь к .torrent, http(s) URL или info hash

Опции:
  -d, --dir <path>       папка загрузки (по умолчанию текущая)
  -p, --port <port>      порт локального HTTP-сервера для стриминга
                         (по умолчанию свободный)
      --only <шаблон>    качать только подходящие файлы, например "*.mp4"
      --exit-when-done   выйти сразу после завершения загрузки
  -q, --quiet            без прогресс-бара, только важные события
  -h, --help             показать справку
  -v, --version          показать версию

Примеры:
  terrent "magnet:?xt=urn:btih:…"
  terrent ./debian.torrent -d D:\\Downloads
  terrent "magnet:?xt=urn:btih:…" --only "*.mkv" --exit-when-done
  terrent ./film.torrent -p 8080     # затем открыть URL из вывода в плеере
`

export function parseArgs (argv) {
  const opts = {
    torrentId: null,
    dir: process.cwd(),
    port: 0,
    only: null,
    exitWhenDone: false,
    quiet: false,
    help: false,
    version: false
  }

  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-h' || arg === '--help') { opts.help = true; continue }
    if (arg === '-v' || arg === '--version') { opts.version = true; continue }
    if (arg === '-q' || arg === '--quiet') { opts.quiet = true; continue }
    if (arg === '--exit-when-done') { opts.exitWhenDone = true; continue }

    if (arg === '-d' || arg === '--dir') {
      opts.dir = requireValue(argv, ++i, arg)
      continue
    }
    if (arg.startsWith('--dir=')) {
      opts.dir = arg.slice('--dir='.length)
      continue
    }

    if (arg === '-p' || arg === '--port') {
      opts.port = parsePort(requireValue(argv, ++i, arg))
      continue
    }
    if (arg.startsWith('--port=')) {
      opts.port = parsePort(arg.slice('--port='.length))
      continue
    }

    if (arg === '--only') {
      opts.only = requireValue(argv, ++i, arg)
      continue
    }
    if (arg.startsWith('--only=')) {
      opts.only = arg.slice('--only='.length)
      continue
    }

    if (arg.startsWith('-')) throw new Error(`Неизвестная опция: ${arg}`)
    positional.push(arg)
  }

  if (positional.length > 1) throw new Error('За один запуск можно добавить только один торрент')
  opts.torrentId = positional[0] ?? null

  return opts
}

function requireValue (argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('-')) throw new Error(`Опция ${flag} требует значение`)
  return value
}

function parsePort (value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Некорректный порт: ${value}`)
  }
  return port
}
