import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { handleApiRequest } from './api-handler.js'

const app = express()
const port = Number(process.env.PORT) || 8787
const googleServicesApiKey = process.env.GOOGLE_MAPS_DEMO_API_KEY || process.env.GOOGLE_MAPS_ROUTES_API_KEY

app.disable('x-powered-by')
app.use(express.json({ limit: '16kb' }))

// Este limite protege o adaptador Express usado para desenvolvimento local.
const geocodingLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Limite temporário de buscas atingido. Aguarde um minuto e tente novamente.' },
})
const routeGenerationLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Limite temporário de gerações atingido. Aguarde um minuto e tente novamente.' },
})

/** Encaminha a requisição Express ao mesmo handler HTTP usado no Worker. */
async function forwardToSharedHandler(request, response) {
  try {
    const headers = new Headers({ 'content-type': 'application/json' })
    const apiRequest = new Request(`http://${request.headers.host}${request.originalUrl}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : JSON.stringify(request.body ?? {}),
    })
    const apiResponse = await handleApiRequest(apiRequest, { apiKey: googleServicesApiKey })
    const payload = await apiResponse.json()

    response.status(apiResponse.status)
    const allowHeader = apiResponse.headers.get('allow')
    if (allowHeader) response.set('Allow', allowHeader)
    return response.json(payload)
  } catch (error) {
    console.error('Falha ao processar solicitação da API:', error.message)
    return response.status(500).json({ error: 'Não foi possível processar a solicitação.' })
  }
}

app.get('/api/health', forwardToSharedHandler)
app.post('/api/geocode', geocodingLimit, forwardToSharedHandler)
app.post('/api/routes/generate', routeGenerationLimit, forwardToSharedHandler)
app.use('/api', (_request, response) => response.status(404).json({ error: 'Endpoint da API não encontrado.' }))

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'A solicitação excede o tamanho permitido.' })
  }
  if (error instanceof SyntaxError) {
    return response.status(400).json({ error: 'O corpo da solicitação precisa conter JSON válido.' })
  }
  console.error('Falha inesperada no adaptador Express:', error.message)
  return response.status(500).json({ error: 'Não foi possível processar a solicitação.' })
})

app.listen(port, () => {
  console.log(`Pacefinder API local disponível em http://localhost:${port}`)
})
