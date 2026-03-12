require("dotenv").config();
const express = require('express')
const cors = require('cors')

const { runResearchWorkflow, runEmailDraftWorkflow } = require('./sdr/sdrController')
const { runLeadDossier } = require('./agent/sdrAgent')

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sdr-backend' })
})

app.post('/api/research', async (req, res) => {
  try {
    const result = await runResearchWorkflow(req.body)
    res.json(result)
  } catch (err) {
    console.error('research error', err)
    res.status(500).json({ error: 'Research workflow failed' })
  }
})

app.post('/api/email-draft', async (req, res) => {
  try {
    const result = await runEmailDraftWorkflow(req.body)
    res.json(result)
  } catch (err) {
    console.error('email draft error', err)
    res.status(500).json({ error: 'Email drafting workflow failed' })
  }
})

app.post('/api/lead-dossier', async (req, res) => {
  const { companyName } = req.body || {}
  console.log('lead-dossier request started', { companyName })

  const timeoutMs = 60000
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('lead-dossier timeout')), timeoutMs)
  })

  const agentPromise = runLeadDossier(companyName).then((dossier) => {
    console.log('lead-dossier agent returned')
    return dossier
  }).catch((err) => {
    console.error('lead-dossier agent error:', err)
    throw err
  })

  try {
    const dossier = await Promise.race([agentPromise, timeoutPromise])
    res.json(dossier)
  } catch (err) {
    console.log('lead-dossier timeout or error occurred', err.message || err)
    const company = companyName || 'there'
    const fallback = {
      topNews: [],
      insights: ['No insights available for this company.'],
      emailDraft: `Hi, we couldn't fetch recent news for ${company}, but would still love to connect.`,
    }
    res.json(fallback)
  }
})

app.listen(port, () => {
  console.log(`SDR backend listening on http://localhost:${port}`)
})
