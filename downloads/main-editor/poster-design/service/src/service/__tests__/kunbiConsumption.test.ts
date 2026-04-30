import assert from 'assert'
import { consumeKunbiForAiAction, getAiPosterKunbiPricing } from '../kunbiConsumption'

async function run() {
  const pricing = getAiPosterKunbiPricing()
  assert.equal(pricing.generateQuality.toolsId, 2121)
  assert.equal(pricing.generateQuality.cost, 400)
  assert.equal(pricing.optimizeCopyPalette.toolsId, 2122)
  assert.equal(pricing.generateFast.cost, 150)
  assert.equal(pricing.replaceText.toolsId, 2124)
  assert.equal(pricing.replaceBackground.toolsId, 2125)
  assert.equal(pricing.replaceHero.toolsId, 2126)
  assert.equal(pricing.relayout.toolsId, 2127)
  assert.equal(pricing.scoreHeroSafety.toolsId, 2128)
  assert.equal(pricing.generateQuality.serviceId, 2121)

  process.env.OPEN_PARTNER_SUBSITE = ' '
  process.env.OPEN_PARTNER_BILLING_SUBSITE = ' '
  process.env.OPEN_PARTNER_BILLING_BASE_URL = ' '
  process.env.KUNBI_API_BASE_URL = ' '
  process.env.KUNBI_CONSUME_API_PATH = ' '
  process.env.OPEN_PARTNER_SERVICE_ID_GENERATE_QUALITY = '9001'
  const result = await consumeKunbiForAiAction({ req: null, action: 'generateQuality' })
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'unconfigured')
  assert.equal(result.toolsId, 2121)
  assert.equal(result.serviceId, 9001)
  assert.equal(result.cost, 400)
  delete process.env.OPEN_PARTNER_SERVICE_ID_GENERATE_QUALITY
  delete process.env.OPEN_PARTNER_SUBSITE
  delete process.env.OPEN_PARTNER_BILLING_SUBSITE
  delete process.env.OPEN_PARTNER_BILLING_BASE_URL
  delete process.env.KUNBI_API_BASE_URL
  delete process.env.KUNBI_CONSUME_API_PATH
}

void run()
