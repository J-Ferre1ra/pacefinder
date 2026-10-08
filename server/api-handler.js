/**
 * Lógica HTTP compartilhada entre o adaptador Express local e o Cloudflare Worker.
 * Usar Request/Response da Web mantém as regras dos endpoints independentes da plataforma.
 */
export async function handleApiRequest(request, { apiKey, rateLimit } = {}) {
  const url = new URL(request.url)

  if (url.pathname === '/api/health') {
    if (request.method !== 'GET') return methodNotAllowed('GET')

    return jsonResponse({
      routesApiConfigured: Boolean(apiKey),
      geocodingApiConfigured: Boolean(apiKey),
    })
  }

  if (url.pathname === '/api/geocode' && request.method === 'POST') {
    const limited = await isRateLimited(rateLimit, request, 'geocode')
    if (limited) return rateLimitResponse('buscas')

    const body = await readJsonBody(request)
    if (body instanceof Response) return body

    const address = body?.address
    if (typeof address !== 'string' || address.trim().length < 2 || address.length > 180) {
      return jsonResponse({ error: 'Informe um endereço ou uma região com até 180 caracteres.' }, 400)
    }
    if (!apiKey) {
      return jsonResponse({ error: 'Configure a Maps Demo Key no servidor para pesquisar endereços.' }, 503)
    }

    try {
      // A geocodificação passa pelo servidor para não expor essa credencial no JavaScript do navegador.
      const googleUrl = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address.trim())}`)
      googleUrl.searchParams.set('languageCode', 'pt-BR')
      const googleResponse = await fetch(googleUrl, {
        headers: { 'X-Goog-Api-Key': apiKey },
        signal: AbortSignal.timeout(10_000),
      })
      const payload = await googleResponse.json()

      if (!googleResponse.ok) {
        console.error('Falha no Geocoding API v4. HTTP:', googleResponse.status)
        return jsonResponse({ error: 'O Google não conseguiu pesquisar esse endereço. Confira a região e tente novamente.' }, 502)
      }

      const result = payload.results?.[0]
      const location = result?.location
      if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
        return jsonResponse({ error: 'Não encontrei esse endereço. Tente informar cidade e estado.' }, 404)
      }

      return jsonResponse({
        lat: location.latitude,
        lng: location.longitude,
        label: result.formattedAddress || address.trim(),
      })
    } catch (error) {
      console.error('Falha de conexão com o Geocoding API v4:', error.message)
      return jsonResponse({ error: 'Não foi possível conectar ao serviço de busca do Google.' }, 502)
    }
  }

  if (url.pathname === '/api/routes/generate' && request.method === 'POST') {
    const limited = await isRateLimited(rateLimit, request, 'routes')
    if (limited) return rateLimitResponse('gerações')

    const body = await readJsonBody(request)
    if (body instanceof Response) return body

    const { origin, targetDistanceMeters, terrain } = body ?? {}
    const validLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90
    const validLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180

    if (!validLatitude(origin?.lat) || !validLongitude(origin?.lng)) {
      return jsonResponse({ error: 'Selecione um ponto de partida válido no mapa.' }, 400)
    }
    if (!Number.isFinite(targetDistanceMeters) || targetDistanceMeters < 2000 || targetDistanceMeters > 15000) {
      return jsonResponse({ error: 'A distância precisa estar entre 2 e 15 km.' }, 400)
    }
    if (!['Qualquer', 'Plano', 'Com subidas'].includes(terrain)) {
      return jsonResponse({ error: 'O terreno selecionado não é válido.' }, 400)
    }
    if (!apiKey) {
      return jsonResponse({ error: 'A Routes API ainda não está configurada neste servidor.' }, 503)
    }

    try {
      const route = await computeLoop({ origin, targetDistanceMeters, terrain, apiKey })
      return jsonResponse(route)
    } catch (error) {
      console.error('Falha ao consultar Google Routes API:', error.message)
      return jsonResponse({ error: 'O Google não encontrou uma rota caminhável para este ponto. Tente outra área.' }, 502)
    }
  }

  if (url.pathname.startsWith('/api/')) return jsonResponse({ error: 'Endpoint da API não encontrado.' }, 404)
  return methodNotAllowed('GET, POST')
}

/** Lê JSON com o mesmo teto de payload da API Express local. */
async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > 16 * 1024) {
    return jsonResponse({ error: 'A solicitação excede o tamanho permitido.' }, 413)
  }

  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
      return jsonResponse({ error: 'A solicitação excede o tamanho permitido.' }, 413)
    }
    return rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return jsonResponse({ error: 'O corpo da solicitação precisa conter JSON válido.' }, 400)
  }
}

async function isRateLimited(rateLimit, request, routeName) {
  return rateLimit ? rateLimit(request, routeName) : false
}

function rateLimitResponse(action) {
  return jsonResponse({ error: `Limite temporário de ${action} atingido. Aguarde um minuto e tente novamente.` }, 429)
}

function methodNotAllowed(allowedMethods) {
  return jsonResponse({ error: 'Método não permitido.' }, 405, { allow: allowedMethods })
}

function jsonResponse(payload, status = 200, headers = {}) {
  return Response.json(payload, { status, headers })
}

/**
 * Monta uma volta estimada e pede ao Google Routes uma rota caminhável pelas vias disponíveis.
 * A distância não é exata: o serviço não otimiza especificamente percursos de corrida.
 */
async function computeLoop({ origin, targetDistanceMeters, terrain, apiKey }) {
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
  if (!googleResponse.ok) throw new Error(payload.error?.message || `HTTP ${googleResponse.status}`)

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
