const NOAA = 'https://services.swpc.noaa.gov'

async function getJSON(path) {
  const res = await fetch(`${NOAA}${path}`)
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
  return res.json()
}

// Turn one raw NOAA alert into something the UI can show
function parseAlert(a) {
  const msg = a.message || ''
  const headlineMatch = msg.match(
    /^(?:EXTENDED WARNING|CONTINUED ALERT|ALERT|WARNING|WATCH|SUMMARY):.*$/m
  )
  const headline = headlineMatch ? headlineMatch[0].trim() : 'Space weather message'
  const scaleMatch = msg.match(/NOAA Scale: ([GSR]\d)/)
  return {
    id: `${a.product_id}-${a.issue_datetime}`,
    time: a.issue_datetime.replace(' ', 'T') + 'Z',
    kind: headline.split(':')[0],
    headline,
    scale: scaleMatch ? scaleMatch[1] : null,
    raw: msg,
  }
}

// Our own simple rule for the demo. NOAA's S1 radiation storm starts at 10 pfu (>=10 MeV).
function radiationLevel(flux) {
  if (flux >= 10) return 'high'
  if (flux >= 1) return 'moderate'
  return 'low'
}

function buildSummary(alerts, protons) {
  const latest = protons[protons.length - 1]
  return {
    radiationLevel: radiationLevel(latest.flux),
    latestFlux: latest.flux,
    latestTime: latest.time,
    alertCount: alerts.length,
    latestAlert: alerts[0] || null,
  }
}

// Clearly labelled sample data, used only if the live request fails
const SAMPLE_ALERTS = [
  { id: 's1', time: '2026-11-13T05:05:40Z', kind: 'CONTINUED ALERT', headline: 'CONTINUED ALERT: Electron 2MeV Integral Flux exceeded 1,000pfu', scale: null, raw: '' },
  { id: 's2', time: '2026-11-10T03:02:27Z', kind: 'EXTENDED WARNING', headline: 'EXTENDED WARNING: Geomagnetic K-index of 4 expected', scale: null, raw: '' },
]
const SAMPLE_PROTONS = Array.from({ length: 12 }, (_, i) => ({
  time: `2026-11-13T0${Math.floor(i / 2)}:${i % 2 ? '30' : '00'}:00Z`,
  flux: 0.2,
}))

export async function getSpaceWeather() {
  try {
    const [alertsRaw, protonsRaw] = await Promise.all([
      getJSON('/products/alerts.json'),
      getJSON('/json/goes/primary/integral-protons-1-day.json'),
    ])
    const alerts = alertsRaw.map(parseAlert)
    const protons = protonsRaw
      .filter(p => p.energy === '>=10 MeV')
      .map(p => ({ time: p.time_tag, flux: p.flux }))
    return { source: 'live', alerts, protons, summary: buildSummary(alerts, protons) }
  } catch (err) {
    console.warn('Live NOAA data failed, using sample data:', err.message)
    return {
      source: 'sample',
      alerts: SAMPLE_ALERTS,
      protons: SAMPLE_PROTONS,
      summary: buildSummary(SAMPLE_ALERTS, SAMPLE_PROTONS),
    }
  }
}
