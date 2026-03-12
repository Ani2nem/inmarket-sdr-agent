const { spawn } = require('child_process')

const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || './mcp-server/index.js'

function invokeTool(toolName, params) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [MCP_SERVER_PATH], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdoutBuffer = ''
    let stderrBuffer = ''
    let settled = false
    const start = Date.now()

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString()
      console.error('MCP stderr:', data.toString())
    })

    child.stdout.on('data', (data) => {
      console.error('MCP stdout data received, ms since start:', Date.now() - start, 'length:', data.length)
      stdoutBuffer += data.toString()
      tryParseResponse()
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      console.error('MCP child process error:', err)
      reject(err)
      child.kill()
    })

    child.on('close', (code) => {
      console.error('MCP child closed with code:', code, 'stdout so far:', stdoutBuffer)
      if (!settled && !stdoutBuffer.includes('Content-Length')) {
        settled = true
        reject(new Error(`MCP server exited (code ${code}) before sending response`))
      }
    })

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params || {},
      },
    }

    const body = JSON.stringify(request)
    const header = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n`
    child.stdin.write(header + body)

    const timeoutHandle = setTimeout(() => {
      if (settled) return
      settled = true
      console.error('MCP client timed out, ms since start:', Date.now() - start)
      reject(new Error('MCP client timeout'))
      child.kill()
    }, 60000)

    function tryParseResponse() {
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return
    
      const headerPart = stdoutBuffer.slice(0, headerEnd)
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(headerPart)
      if (!lengthMatch) return
    
      const contentLength = parseInt(lengthMatch[1], 10)
      const bodyStart = headerEnd + 4
      const bodyBuffer = Buffer.from(stdoutBuffer, 'utf8')
    
      if (bodyBuffer.length < bodyStart + contentLength) return
    
      const bodyStr = bodyBuffer.slice(bodyStart, bodyStart + contentLength).toString('utf8')
      stdoutBuffer = bodyBuffer.slice(bodyStart + contentLength).toString('utf8')
    
      let parsed
      try {
        parsed = JSON.parse(bodyStr)
      } catch (err) {
        if (settled) return
        settled = true
        reject(err)
        child.kill()
        return
      }
    
      if (parsed.error) {
        if (settled) return
        settled = true
        reject(new Error(parsed.error.message || 'MCP server error'))
        child.kill()
        return
      }
    
      try {
        const content = parsed.result?.content?.[0]?.text
        const payload = content ? JSON.parse(content) : null
        if (settled) return
        settled = true
        clearTimeout(timeoutHandle)
        console.error('MCP resolved successfully, ms since start:', Date.now() - start)
        resolve(payload)
      } catch (err) {
        if (settled) return
        settled = true
        reject(err)
      } finally {
        child.kill()
      }
    }
  })
}

module.exports = {
  mcpClient: { invokeTool },
}