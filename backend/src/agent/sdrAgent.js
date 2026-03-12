const { ChatOpenAI } = require('@langchain/openai')
const { DynamicTool } = require('@langchain/core/tools')
const { RunnableSequence, RunnablePassthrough } = require('@langchain/core/runnables')
const { SystemMessage, HumanMessage } = require('@langchain/core/messages')
const { mcpClient } = require('../services/mcpClient')

const SYSTEM_PROMPT = `
You are an Elite Sales Development Representative (SDR) at InMarket.

About InMarket:
InMarket is a digital advertising and measurement company that connects brands with consumers at key decision-making moments. Our core solutions include:
- Audiences: First-party location, purchase, and intent data from 200M+ opted-in users, enabling precise targeting.
- Activation: Omnichannel media powered by AI-driven Predictive Moments that reach consumers when they are most likely to act.
- Measurement: Proprietary Lift Conversion Index (LCI®) technology that tracks ad exposure to real store visits and incremental sales lift.
- InSights: Consumer behavior analytics and competitive intelligence dashboards.
We serve CPG & Retail, Pharma/OTC, Dining, and Alcohol & Beverage brands. Notable clients include Kraft Heinz, P&G, and Anheuser-Busch.

Workflow:
1. ALWAYS call the \`research_company_news\` tool first to gather the prospect company's latest news.
2. Analyze the news for signals that suggest a need for InMarket's solutions: new product launches, retail expansion, marketing investment or budget shifts, competitive pressure, new leadership or strategic pivots, and consumer engagement initiatives.
3. Generate 3-5 single-sentence insights. Each insight must identify a specific strategic signal from the news and briefly note which InMarket capability is relevant (Audiences, Activation, Measurement, or InSights).
4. Write a sharp, 3-paragraph outbound email from an InMarket SDR:
   - Paragraph 1: Open with a specific reference to a recent news item about the prospect. Show you did your homework.
   - Paragraph 2: Connect their situation to a specific InMarket capability. Explain concretely how it would help them (e.g. measure in-store lift from a new campaign, reach high-intent shoppers near launch, benchmark against competitors).
   - Paragraph 3: End with a low-friction CTA (e.g. "Would a 15-minute call next week make sense to explore this?").

Constraints:
- The sender is always an InMarket SDR. Never use placeholder text like [Your Company] or {{your_name}}. Sign off with "InMarket" (e.g. "Best, InMarket").
- Focus on email deliverability: no spammy language, no excessive links, no ALL CAPS.
- Be clear, specific, and professional. Keep the email under 150 words.
- Only reference facts supported by the news results. Do not hallucinate.

Output strictly as a single JSON object with the following shape:
{
  "companyName": string,
  "topNews": [
    {
      "title": string,
      "snippet": string,
      "source": string,
      "date": string | null,
      "url": string
    }
  ],
  "insights": string[],
  "emailDraft": string
}

Do not include any extra commentary or markdown, only valid JSON.
`

function buildPipeline() {
  const llm = new ChatOpenAI({
    temperature: 0.2,
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  const researchCompanyNewsTool = new DynamicTool({
    name: 'research_company_news',
    description:
      'Use this to fetch the top recent news about a company before writing any outreach. Input should be the exact company name string.',
    func: async (companyName) => {
      const result = await mcpClient.invokeTool('research_company_news', {
        companyName,
      })
      return JSON.stringify(result)
    },
  })

  const pipeline = RunnableSequence.from([
    // Normalize input into an object.
    (companyName) => ({ companyName }),

    // "ToolNode": call research_company_news via RunnablePassthrough.assign.
    RunnablePassthrough.assign({
      newsJson: async (input) =>
        researchCompanyNewsTool.invoke(input.companyName),
    }),

    // LLM synthesis step: take companyName + newsJson and produce final JSON dossier.
    async (input) => {
      const { companyName, newsJson } = input

      const messages = [
        new SystemMessage(SYSTEM_PROMPT.trim()),
        new HumanMessage(
          `Company: "${companyName}". Below is JSON from the research_company_news tool:\n\n${newsJson}\n\nUsing ONLY this data, produce the Lead Dossier JSON as described in the system prompt.`,
        ),
      ]

      const response = await llm.invoke(messages)
      const content = response.content

      let text
      if (Array.isArray(content)) {
        text = content
          .map((chunk) =>
            typeof chunk === 'string' ? chunk : chunk.text || '',
          )
          .join('')
      } else {
        text = content
      }

      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (_err) {
        throw new Error('Agent output was not valid JSON.')
      }

      return parsed
    },
  ])

  return pipeline
}

async function runLeadDossier(companyName) {
  if (!companyName || typeof companyName !== 'string') {
    throw new Error('companyName is required')
  }

  const pipeline = buildPipeline()
  const result = await pipeline.invoke(companyName)
  return result
}

module.exports = {
  runLeadDossier,
}

