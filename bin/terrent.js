#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, USAGE } from '../src/args.js'
import { run } from '../src/download.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function version () {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
  return pkg.version
}

let opts
try {
  opts = parseArgs(process.argv.slice(2))
} catch (err) {
  console.error(`Ошибка: ${err.message}`)
  console.error(USAGE)
  process.exit(1)
}

if (opts.help) {
  console.log(USAGE)
  process.exit(0)
}

if (opts.version) {
  console.log(version())
  process.exit(0)
}

if (!opts.torrentId) {
  console.error(USAGE)
  process.exit(1)
}

run(opts).catch(err => {
  console.error(`Ошибка: ${err.message}`)
  process.exit(1)
})
