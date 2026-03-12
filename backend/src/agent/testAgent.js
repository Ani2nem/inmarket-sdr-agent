require('dotenv').config()
const { runLeadDossier } = require('./sdrAgent')


async function main() {
  const companyName = 'Nike'

  try {
    console.log(`Running Lead Dossier agent for company: ${companyName}\n`)
    const result = await runLeadDossier(companyName)
    console.log('Lead Dossier result:\n')
    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('\nLead Dossier test failed.')
    console.error('Error:', err.message || err)
  }
}

main()

