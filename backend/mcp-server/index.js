#!/usr/bin/env node

console.log = (...args) => console.error(...args);
require("dotenv").config({ quiet: true });

const { tools } = require('./src/tools')

let buffer = ''

process.stdin.setEncoding('utf8')

process.stdin.on('data', (chunk) => {
  buffer += chunk
  processBuffer()
})

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) return

    const headerPart = buffer.slice(0, headerEnd)
    const lengthMatch = /Content-Length:\s*(\d+)/i.exec(headerPart)

    if (!lengthMatch) {
      buffer = buffer.slice(headerEnd + 4)
      continue
    }

    const contentLength = parseInt(lengthMatch[1], 10)
    const bodyStart = headerEnd + 4

    if (buffer.length < bodyStart + contentLength) {
      return
    }

    const body = buffer.slice(bodyStart, bodyStart + contentLength)
    buffer = buffer.slice(bodyStart + contentLength)

    handleMessage(body).catch((err) => {
      console.error('MCP server message handling error:', err)
    })
  }
}

async function handleMessage(body) {
  console.error('[handleMessage] received body length:', body.length)
  let message
  try {
    message = JSON.parse(body)
  } catch (_err) {
    sendError(null, -32700, 'Parse error')
    return
  }

  const { id, method, params } = message
  console.error('[handleMessage] method:', method)

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params || {}
    const tool = tools[name]

    if (!tool) {
      sendError(id, -32601, `Unknown tool: ${name}`)
      return
    }

    try {
      console.error('[handleMessage] calling tool:', name)
      const result = await tool(args || {})
      console.error('[handleMessage] tool returned, calling sendResult')

      const content = [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result),
        },
      ]

      sendResult(id, { content })
    } catch (err) {
      sendError(id, -32000, err.message || String(err))
    }
    return
  }

  sendError(id, -32601, `Unsupported method: ${method}`)
}

function sendResult(id, result) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id,
    result,
  })
  writeFramed(payload)
}

function sendError(id, code, message) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  })
  writeFramed(payload)
}

function writeFramed(body) {
  const length = Buffer.byteLength(body, 'utf8')
  const header = `Content-Length: ${length}\r\n\r\n`
  process.stderr.write(`[writeFramed] writing ${length} bytes to stdout\n`)
  process.stdout.write(header + body)
  process.stderr.write(`[writeFramed] write complete\n`)
}

process.stdin.resume()