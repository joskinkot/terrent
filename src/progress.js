/**
 * Вывод в терминал: строка прогресса перерисовывается на месте (TTY),
 * а обычные сообщения печатаются с новой строки.
 */
export class View {
  constructor ({ quiet = false, stream = process.stdout } = {}) {
    this.quiet = quiet
    this.stream = stream
    this.tty = !!stream.isTTY
    this.line = ''
    this.lastPlainAt = 0

    // Не падать, если вывод закрыли (например, `terrent … | head`).
    this.stream.on?.('error', () => {})
  }

  print (message) {
    this.clearLine()
    this.stream.write(`${message}\n`)
  }

  draw (line) {
    if (this.quiet || !this.tty) return
    if (line === this.line) return
    this.stream.write(`\r\x1b[2K${line}`)
    this.line = line
  }

  /** В неинтерактивном режиме печатает строку не чаще, чем раз в `everyMs`. */
  drawPlain (line, everyMs = 5000) {
    if (this.quiet || this.tty) return
    const now = Date.now()
    if (now - this.lastPlainAt < everyMs) return
    this.lastPlainAt = now
    this.stream.write(`${line}\n`)
  }

  clearLine () {
    if (this.tty && this.line) {
      this.stream.write('\r\x1b[2K')
      this.line = ''
    }
  }

  end () {
    if (this.tty && this.line) {
      this.stream.write('\n')
      this.line = ''
    }
  }
}
