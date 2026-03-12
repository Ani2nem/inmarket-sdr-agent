const { mcpClient } = require('../services/mcpClient')

async function runResearchWorkflow(payload) {
  const { linkedinUrl, companyDomain, crmAccountId } = payload || {}

  const research = await mcpClient.invokeTool('prospect_research', {
    linkedinUrl,
    companyDomain,
    crmAccountId,
  })

  return { research }
}

async function runEmailDraftWorkflow(payload) {
  const { researchSummary, persona, tone } = payload || {}

  const draft = await mcpClient.invokeTool('email_draft', {
    researchSummary,
    persona,
    tone,
  })

  return { draft }
}

module.exports = {
  runResearchWorkflow,
  runEmailDraftWorkflow,
}
