import { handleApiRequest } from '../server/api-handler.js'

/**
 * O Worker atende a API; pedidos de arquivos estáticos são servidos pelo binding ASSETS.
 * A Cloudflare publica esses arquivos junto com o Worker em uma única implantação.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    const apiKey = env.GOOGLE_MAPS_DEMO_API_KEY || env.GOOGLE_MAPS_ROUTES_API_KEY
    const rateLimit = async (apiRequest, routeName) => {
      const limiter = routeName === 'geocode' ? env.GEOCODE_RATE_LIMITER : env.ROUTE_RATE_LIMITER
      // Sem autenticação de usuário, o IP fornecido pela Cloudflare é a chave disponível no MVP.
      // Usuários na mesma rede podem compartilhar o limite, e a contagem é aproximada por região.
      const clientAddress = apiRequest.headers.get('cf-connecting-ip') || 'local-development'
      const { success } = await limiter.limit({ key: `${routeName}:${clientAddress}` })
      return !success
    }

    return handleApiRequest(request, { apiKey, rateLimit })
  },
}
