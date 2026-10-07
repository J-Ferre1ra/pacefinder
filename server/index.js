import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'

const app = express()
const port = Number(process.env.PORT) || 8787
// Em prototipagem, a Demo Key autorizada é configurada no servidor para os
// serviços web v4. A variável antiga continua aceita para uma futura chave padrão.
const googleServicesApiKey = process.env.GOOGLE_MAPS_DEMO_API_KEY || process.env.GOOGLE_MAPS_ROUTES_API_KEY

app.disable('x-powered-by')
app.use(express.json({ limit: '16kb' }))

// O limite protege a quota diária da Demo Key e reduz risco numa futura chave faturada.
const routeGenerationLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Limite temporário de geração atingido. Aguarde um minuto e tente novamente.' },
})
const geocodingLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Limite temporário de buscas atingido. Aguarde um minuto e tente novamente.' },
})

app.get('/api/health', (_request, response) => {
  // Informa apenas se a integração está configurada; nunca devolve a credencial.
  response.json({
    routesApiConfigured: Boolean(googleServicesApiKey),
    geocodingApiConfigured: Boolean(googleServicesApiKey),
  })
})

app.post('/api/geocode', geocodingLimit, async (request, response) => {
  const address = request.body?.address
  if (typeof address !== 'string' || address.trim().length < 2 || address.length > 180) {
    return response.status(400).json({ error: 'Informe um endereço ou uma região com até 180 caracteres.' })
  }
  if (!googleServicesApiKey) {
    return response.status(503).json({ error: 'Configure a Maps Demo Key no servidor para pesquisar endereços.' })
  }

  try {
    // O v4 é o serviço de geocodificação listado entre os recursos da Demo Key.
    // A busca passa pelo servidor para não enviar a chave de serviço no bundle da interface.
    const url = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address.trim())}`)
    url.searchParams.set('languageCode', 'pt-BR')
    const googleResponse = await fetch(url, {
      headers: { 'X-Goog-Api-Key': googleServicesApiKey },
      signal: AbortSignal.timeout(10_000),
    })
    const payload = await googleResponse.json()
    if (!googleResponse.ok) {
      // Não registramos o endereço nem a resposta integral para evitar guardar dado de localização.
      console.error('Falha no Geocoding API v4. HTTP:', googleResponse.status)
      return response.status(502).json({ error: 'O Google não conseguiu pesquisar esse endereço. Confira a região e tente novamente.' })
    }

    const result = payload.results?.[0]
    const location = result?.location
    if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
      return response.status(404).json({ error: 'Não encontrei esse endereço. Tente informar cidade e estado.' })
    }

    return response.json({
      lat: location.latitude,
      lng: location.longitude,
      label: result.formattedAddress || address.trim(),
    })
  } catch (error) {
    console.error('Falha de conexão com o Geocoding API v4:', error.message)
    return response.status(502).json({ error: 'Não foi possível conectar ao serviço de busca do Google.' })
  }
})

app.post('/api/routes/generate', routeGenerationLimit, async (request, response) => {
  const { origin, targetDistanceMeters, terrain } = request.body ?? {}
  const validCoordinate = (value) => Number.isFinite(value) && value >= -90 && value <= 90
  const validLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180

  if (!validCoordinate(origin?.lat) || !validLongitude(origin?.lng)) {
    return response.status(400).json({ error: 'Selecione um ponto de partida válido no mapa.' })
  }
  if (!Number.isFinite(targetDistanceMeters) || targetDistanceMeters < 2000 || targetDistanceMeters > 15000) {
    return response.status(400).json({ error: 'A distância precisa estar entre 2 e 15 km.' })
  }
  if (!['Qualquer', 'Plano', 'Com subidas'].includes(terrain)) {
    return response.status(400).json({ error: 'O terreno selecionado não é válido.' })
  }
  if (!googleServicesApiKey) {
    return response.status(503).json({ error: 'A Routes API ainda não está configurada neste servidor.' })
  }

  try {
    const route = await computeLoop({ origin, targetDistanceMeters, terrain, apiKey: googleServicesApiKey })
    return response.json(route)
  } catch (error) {
    console.error('Falha ao consultar Google Routes API:', error.message)
    return response.status(502).json({ error: 'O Google não encontrou uma rota caminhável para este ponto. Tente outra área.' })
  }
})

/**
 * Monta uma volta com pontos de passagem estimados e consulta a Routes API.
 * A distância final é aproximada: o serviço de caminhada não otimiza especificamente para corrida.
 */
async function computeLoop({ origin, targetDistanceMeters, terrain, apiKey }) {
  // O fator inicial compensa o fato de ruas raramente formarem um círculo perfeito.
  const radius = targetDistanceMeters / (2 * Math.PI) * 0.72
  const latitudeOffset = radius / 111_320
  const longitudeOffset = radius / (111_320 * Math.max(Math.cos(origin.lat * Math.PI / 180), 0.2))
  const terrainBias = terrain === 'Com subidas' ? 1.14 : terrain === 'Plano' ? 0.9 : 1
  const offsets = [
    [latitudeOffset * terrainBias, longitudeOffset * 0.2],
    [latitudeOffset * 0.1, longitudeOffset * terrainBias],
    [-latitudeOffset * terrainBias, longitudeOffset * 0.1],
    [-latitudeOffset * 0.1, -longitudeOffset * terrainBias],
  ]
  const intermediates = offsets.map(([lat, lng]) => ({
    location: { latLng: { latitude: origin.lat + lat, longitude: origin.lng + lng } },
    via: true,
  }))

  const googleResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      intermediates,
      travelMode: 'WALK',
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(12_000),
  })

  const payload = await googleResponse.json()
  if (!googleResponse.ok) {
    throw new Error(payload.error?.message || `HTTP ${googleResponse.status}`)
  }
  const route = payload.routes?.[0]
  if (!route?.polyline?.encodedPolyline || !Number.isFinite(route.distanceMeters)) {
    throw new Error('Resposta sem geometria de rota')
  }

  return {
    distanceMeters: route.distanceMeters,
    duration: route.duration ?? null,
    encodedPolyline: route.polyline.encodedPolyline,
    provider: 'google-routes',
    distanceIsApproximate: Math.abs(route.distanceMeters - targetDistanceMeters) / targetDistanceMeters > 0.15,
  }
}

app.listen(port, () => {
  console.log(`Smart Route API disponível em http://localhost:${port}`)
})
