import createTorrent from "create-torrent"
import fs from "node:fs"
fs.mkdirSync("tmp/seed", { recursive: true })
fs.writeFileSync("tmp/seed/note.txt", "terrent smoke test")
const buf = await new Promise((res, rej) => createTorrent("tmp/seed", (e, b) => e ? rej(e) : res(b)))
fs.writeFileSync("tmp/note.torrent", buf)
console.log("torrent written", buf.length, "bytes")
