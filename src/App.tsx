import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import GoogleMapPanel, { type GoogleMapHandle, type SelectedPlace } from './GoogleMapPanel'
import './App.css'

type RouteOption = {
  id: string
  name: string
  distance: number
  time: number
  elevation: number
  popularity: number
  rating: number
  reviews: number
  shape: string
}

const demoRoutes: RouteOption[] = [
  {
    id: 'r1',
    name: 'Circuito do parque',
    distance: 5.1,
    time: 31,
    elevation: 42,
    popularity: 92,
    rating: 4.8,
    reviews: 34,
    shape: 'M 110 286 C 149 230 196 202 244 224 C 281 241 309 208 342 168 C 381 122 437 142 461 184 C 481 220 447 260 405 273 C 354 289 322 327 276 329 C 219 332 174 307 110 286',
  },
  {
    id: 'r2',
    name: 'Volta das alamedas',
    distance: 4.7,
    time: 29,
    elevation: 28,
    popularity: 78,
    rating: 4.6,
    reviews: 21,
    shape: 'M 110 286 C 157 269 172 222 217 202 C 260 183 293 212 326 228 C 366 247 387 228 426 199 C 457 177 484 189 498 218 C 475 254 436 279 394 279 C 354 280 328 316 276 329 C 222 341 173 313 110 286',
  },
  {
    id: 'r3',
    name: 'Rota das colinas',
    distance: 6.2,
    time: 39,
    elevation: 86,
    popularity: 63,
    rating: 4.7,
    reviews: 18,
    shape: 'M 110 286 C 156 246 181 218 217 202 C 265 181 290 151 342 168 C 389 184 416 150 461 184 C 495 210 477 246 436 267 C 394 289 369 319 319 323 C 256 329 190 323 110 286',
  },
]

const demoActivityAreas = [
  { x: '26%', y: '38%', size: 18 },
  { x: '46%', y: '60%', size: 13 },
  { x: '73%', y: '34%', size: 16 },
]

function Icon({ name }: { name: 'pin' | 'search' | 'target' | 'shield' | 'arrow' }) {
  const paths: Record<typeof name, string> = {
    pin: 'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z M12 10a2.5 2.5 0 1 0 0-.01Z',
    search: 'm21 21-4.35-4.35 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
    target: 'M12 2v3m0 14v3M2 12h3m14 0h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 12h.01',
    shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z M9 12l2 2 4-4',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
  }

  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

function DemoMap({ selectedRoute }: { selectedRoute: RouteOption }) {
  return (
    <section className="map-panel" aria-label="Prévia demonstrativa do mapa">
      <div className="map-surface">
        <div className="map-grid" />
        <svg className="street-map" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mapa ilustrativo com áreas de atividade simuladas">
          <g className="parks">
            <path d="M380 36c32-19 81-15 101 9 16 19 2 37-8 55-12 20-10 43-39 50-29 7-54-9-57-31-3-22-28-61 3-83ZM76 138c24-18 58-5 66 15 7 19-5 32-23 40-22 9-36 34-59 22-21-11-17-58 16-77ZM510 332c19-17 52-20 71-5 22 17 16 46-6 57-17 8-52 18-69-2-15-17-17-35 4-50Z" />
          </g>
          <g className="streets minor-streets">
            <path d="M-15 93 171 186 338 200 672 109M-12 149 165 227 355 241 673 167M-12 216 159 264 337 291 669 231M-10 277 162 311 345 347 669 301M-18 347 169 367 360 402 664 369M61-20 88 103 113 191 99 294 136 500M149-25 174 101 181 209 207 330 213 495M249-16 250 106 275 218 268 344 301 499M356-20 342 91 358 198 373 328 381 498M450-22 436 91 465 201 450 327 478 497M557-20 527 95 545 194 534 314 568 497" />
          </g>
          <g className="streets major-streets">
            <path d="M-20 119C109 139 152 205 258 215s167-50 420-40M-11 318c110-38 182-26 273 4s191 38 401-24M134-22c20 112 88 155 138 239s85 125 101 283M491-20c-24 128-42 190-6 260s55 132 65 256" />
          </g>
          <path className="route-line route-muted" d={demoRoutes[1].shape} />
          <path className="route-line route-active" d={selectedRoute.shape} />
          <circle className="route-start" cx="110" cy="286" r="8" />
          <circle className="route-start-ring" cx="110" cy="286" r="15" />
        </svg>
        {demoActivityAreas.map((area, index) => (
          <span aria-hidden="true" className="activity-dot" key={index} style={{ left: area.x, top: area.y, width: area.size, height: area.size }} />
        ))}
        <div className="map-topline">
          <div className="map-location">
            <span>Prévia ilustrativa</span>
          </div>
        </div>
        <div className="map-legend">
          <span className="legend-title">Atividade simulada</span>
          <div className="legend-scale"><span>Menos</span><i /><i /><i /><span>Mais</span></div>
        </div>
        <div className="map-key-notice">Mapa e rota sem relação com o local pesquisado.</div>
      </div>
    </section>
  )
}

function App() {
  const [place, setPlace] = useState('Sua região')
  const [origin, setOrigin] = useState<SelectedPlace | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [routesApiConfigured, setRoutesApiConfigured] = useState(false)
  const [geocodingApiConfigured, setGeocodingApiConfigured] = useState(false)
  const [routePolyline, setRoutePolyline] = useState<string | null>(null)
  const [routeError, setRouteError] = useState('')
  const [routeNotice, setRouteNotice] = useState('')
  const [liveDistance, setLiveDistance] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [distance, setDistance] = useState(5)
  const [terrain, setTerrain] = useState<'Qualquer' | 'Plano' | 'Com subidas'>('Plano')
  const [selectedRouteId, setSelectedRouteId] = useState('r1')
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const mapRef = useRef<GoogleMapHandle>(null)
  const searchDialogRef = useRef<HTMLDialogElement>(null)
  const guideDialogRef = useRef<HTMLDialogElement>(null)
  // VITE_* é incorporada ao JavaScript do navegador. Aqui usamos somente a Demo Key,
  // que tem recursos e limite de prototipagem e não pode gerar cobrança.
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

  // O elemento nativo <dialog> cuida do foco e do fundo modal; o estado React
  // mantém o modal sincronizado com os botões, a tecla Esc e a conclusão da busca.
  useEffect(() => {
    const dialog = searchDialogRef.current
    if (!dialog) return
    if (searchOpen && !dialog.open) dialog.showModal()
    if (!searchOpen && dialog.open) dialog.close()
  }, [searchOpen])

  useEffect(() => {
    const dialog = guideDialogRef.current
    if (!dialog) return
    if (guideOpen && !dialog.open) dialog.showModal()
    if (!guideOpen && dialog.open) dialog.close()
  }, [guideOpen])

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API indisponível')))
      .then((health: { routesApiConfigured?: boolean; geocodingApiConfigured?: boolean }) => {
        setRoutesApiConfigured(Boolean(health.routesApiConfigured))
        setGeocodingApiConfigured(Boolean(health.geocodingApiConfigured))
      })
      .catch(() => setRoutesApiConfigured(false))
  }, [])

  const onOriginChange = useCallback((selected: SelectedPlace) => {
    setOrigin(selected)
    setPlace(selected.label)
    setRoutePolyline(null)
    setLiveDistance(null)
    setRouteNotice('')
    setGenerated(false)
  }, [])

  const onMapReady = useCallback((ready: boolean) => setMapReady(ready), [])
  const onMapError = useCallback((message: string) => setRouteError(message), [])

  const selectedRoute = useMemo(() => demoRoutes.find((route) => route.id === selectedRouteId) ?? demoRoutes[0], [selectedRouteId])
  const filteredRoutes = useMemo(() => demoRoutes.filter((route) => terrain === 'Qualquer' || (terrain === 'Plano' ? route.elevation < 60 : route.elevation >= 60)), [terrain])

  function searchPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const search = query.trim()
    if (!search) return
    setRouteError('')
    if (mapsApiKey) {
      if (!mapReady) {
        setRouteError('O mapa ainda está carregando. Tente novamente em alguns segundos.')
        return
      }
      if (!geocodingApiConfigured) {
        setRouteError('Para buscar endereços, coloque a Maps Demo Key também em GOOGLE_MAPS_DEMO_API_KEY no arquivo .env e reinicie o servidor.')
        return
      }
      mapRef.current?.search(search)
        .then(() => {
          setQuery('')
          setSearchOpen(false)
        })
        .catch((error: Error) => setRouteError(error.message))
      return
    }
    setPlace(search)
    setOrigin(null)
    setRoutePolyline(null)
    setRouteError('Busca de endereço real exige uma chave do Google Maps. No modo de demonstração, a região é apenas um rótulo.')
    setQuery('')
    setSearchOpen(false)
  }

  function requestCurrentLocation() {
    setRouteError('')
    setRouteNotice('')
    if (mapsApiKey) {
      mapRef.current?.locate()
        .then(() => setSearchOpen(false))
        .catch((error: Error) => setRouteError(error.message))
      return
    }
    // Só pedimos a localização após a ação explícita; o navegador ainda solicitará consentimento.
    if (!navigator.geolocation) {
      setPlace('Localização indisponível')
      setRouteError('Este navegador não oferece geolocalização.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const selected: SelectedPlace = { lat: coords.latitude, lng: coords.longitude, label: `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}` }
        setOrigin(selected)
        setPlace(selected.label)
        setSearchOpen(false)
      },
      () => setRouteError('Não foi possível obter sua localização. Verifique a permissão do navegador.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  function centerMap() {
    if (origin && mapsApiKey) {
      mapRef.current?.focus(origin)
      return
    }
    requestCurrentLocation()
  }

  async function generateRoute() {
    setRouteError('')
    setGenerating(true)
    setRoutePolyline(null)
    if (mapsApiKey) {
      if (!routesApiConfigured) {
        setRouteError('Para calcular uma rota real, coloque a Maps Demo Key em GOOGLE_MAPS_DEMO_API_KEY no arquivo .env e reinicie o servidor.')
        setGenerating(false)
        return
      }
      if (!origin) {
        setRouteError('Busque uma região ou use sua localização para definir o ponto de partida.')
        setGenerating(false)
        return
      }
      try {
        const response = await fetch('/api/routes/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin: { lat: origin.lat, lng: origin.lng }, targetDistanceMeters: Math.round(distance * 1000), terrain }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Não foi possível gerar uma rota.')
        setRoutePolyline(result.encodedPolyline)
        setLiveDistance(result.distanceMeters / 1000)
        setRouteNotice(result.distanceIsApproximate
          ? `A rota tem ${((result.distanceMeters ?? 0) / 1000).toFixed(1)} km; a meta de ${distance.toFixed(1)} km é aproximada. Rotas a pé podem não incluir calçadas ou caminhos de pedestres; confira o percurso. Inclinação, iluminação e segurança não validadas.`
          : 'Rota a pé calculada pelo Google. Caminhos de pedestres podem estar incompletos; confira o percurso. Inclinação, iluminação e segurança não são validadas.')
        setSelectedRouteId('r1')
        setGenerated(true)
      } catch (error) {
        setRouteError(error instanceof Error ? error.message : 'Falha ao conectar ao serviço de rotas.')
      } finally {
        setGenerating(false)
      }
      return
    }
    // O modo sem credenciais mantém a interação demonstrável, sem simular uma chamada real ao Google.
    window.setTimeout(() => {
      setSelectedRouteId('r1')
      setGenerated(true)
      setGenerating(false)
    }, 650)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Pacefinder início">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>PACE<span className="brand-light">FINDER</span></span>
        </a>
        <div className="top-actions">
          <button className="help-trigger" onClick={() => { setGuideStep(0); setGuideOpen(true) }} type="button">Como usar</button>
          <span className="demo-pill"><span /> {mapsApiKey ? 'MAPA GOOGLE · DADOS DEMO' : 'MODO DEMONSTRAÇÃO'}</span>
        </div>
      </header>

      <main id="main" className="page-content">
        <section className="intro-row">
          <div>
            <p className="eyebrow">ENCONTRE SEU PRÓXIMO CAMINHO</p>
            <h1>Encontre seu<br /><em>próximo percurso.</em></h1>
          </div>
          <p className="intro-copy">Escolha onde começar. Ajuste a distância. O caminho aparece no mapa.</p>
        </section>

        <div className="search-bar">
          <div className="search-location">
            <Icon name="pin" />
            <div className="search-location-copy"><span>LOCAL DE PARTIDA</span><strong>{place}</strong></div>
          </div>
          <div className="search-actions">
            <button className="text-action" onClick={requestCurrentLocation} type="button"><Icon name="target" /> Minha localização</button>
            <button className="search-submit" onClick={() => { setQuery(''); setRouteError(''); setSearchOpen(true) }} type="button"><Icon name="search" /> Buscar bairro</button>
          </div>
        </div>

        <dialog className="app-dialog search-dialog" ref={searchDialogRef} onClose={() => setSearchOpen(false)} onCancel={() => setSearchOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false) }}>
          <div className="dialog-content">
            <div className="dialog-heading">
              <div><p className="eyebrow">PONTO DE PARTIDA</p><h2>Onde você quer correr?</h2></div>
              <button aria-label="Fechar busca" className="dialog-close" onClick={() => setSearchOpen(false)} type="button">×</button>
            </div>
            <p className="dialog-copy">Digite um bairro, cidade ou endereço para posicionar o mapa.</p>
            <form className="dialog-search-form" onSubmit={searchPlace}>
              <label htmlFor="place-search">Bairro ou região</label>
              <input autoFocus id="place-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Boa Viagem, Recife" />
              {routeError && <p className="dialog-error" role="alert">{routeError}</p>}
              <button className="search-submit" type="submit"><Icon name="search" /> Buscar região</button>
            </form>
            <button className="dialog-location-action" onClick={requestCurrentLocation} type="button"><Icon name="target" /> Usar minha localização atual</button>
          </div>
        </dialog>

        <dialog className="app-dialog guide-dialog" ref={guideDialogRef} onClose={() => setGuideOpen(false)} onCancel={() => setGuideOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setGuideOpen(false) }}>
          <div className="dialog-content">
            <div className="dialog-heading">
              <div><p className="eyebrow">GUIA RÁPIDO · PASSO {guideStep + 1} DE 3</p><h2>{['Escolha onde começar', 'Ajuste seu percurso', 'Confira a rota'][guideStep]}</h2></div>
              <button aria-label="Fechar guia" className="dialog-close" onClick={() => setGuideOpen(false)} type="button">×</button>
            </div>
            <div aria-label={`Passo ${guideStep + 1} de 3`} className="guide-progress">
              {[0, 1, 2].map((step) => <span className={step <= guideStep ? 'guide-progress-active' : ''} key={step} />)}
            </div>
            <p className="dialog-copy">{[
              'Busque seu bairro ou toque em “Minha localização”. Você também pode selecionar o ponto de partida diretamente no mapa.',
              'Escolha uma distância aproximada e a preferência de terreno. Esses critérios orientam a sugestão de percurso.',
              'Toque em “Gerar meu percurso” e confira o caminho no mapa. A distância pode variar e o protótipo não valida iluminação ou segurança.',
            ][guideStep]}</p>
            <div className="guide-actions">
              {guideStep > 0 && <button className="dialog-secondary-action" onClick={() => setGuideStep((step) => step - 1)} type="button">Voltar</button>}
              <button className="search-submit" onClick={() => guideStep < 2 ? setGuideStep((step) => step + 1) : setGuideOpen(false)} type="button">{guideStep < 2 ? 'Próximo passo' : 'Entendi'}</button>
            </div>
          </div>
        </dialog>

        <div className="demo-banner" role="status">
          <span className="demo-banner-icon">i</span>
          <p><strong>{mapsApiKey ? 'Popularidade demonstrativa.' : 'Modo de demonstração.'}</strong> A frequência de corredores e as avaliações são simuladas. {mapsApiKey ? 'O mapa base usa Google Maps.' : 'Sem chave, mapa e busca são ilustrativos.'}</p>
        </div>

        <section id="explore" className="workspace-grid">
          <aside className="filters-panel">
            <div className="section-heading"><div><p className="eyebrow">PREFERÊNCIAS</p><h2>Seu percurso</h2></div></div>

            <div className="filter-group distance-group">
              <div className="filter-label-row"><label htmlFor="distance">Distância aproximada</label><strong>{distance.toFixed(1)} <small>km</small></strong></div>
              <input id="distance" aria-valuetext={`${distance.toFixed(1)} quilômetros`} type="range" min="2" max="15" step="0.5" value={distance} onChange={(event) => setDistance(Number(event.target.value))} style={{ background: `linear-gradient(90deg, #4f8055, #4f8055 ${(distance - 2) / 13 * 100}%, #e1e8e1 ${(distance - 2) / 13 * 100}%, #e1e8e1 100%)` }} />
              <div className="range-labels"><span>2 km</span><span>15 km</span></div>
            </div>

            <p className="loop-note">↻ <span>Rota circular · volta ao ponto de partida</span></p>

            <fieldset className="filter-group terrain-group">
              <legend>Terreno preferido</legend>
              <div className="segmented-control">
                {(['Qualquer', 'Plano', 'Com subidas'] as const).map((option) => (
                  <button aria-pressed={terrain === option} className={terrain === option ? 'segment-active' : ''} key={option} onClick={() => setTerrain(option)} type="button">{option}</button>
                ))}
              </div>
            </fieldset>

            <button className="generate-button" onClick={generateRoute} type="button" disabled={generating}>
              {generating ? <span className="spinner" /> : <span className="generate-symbol">↗</span>}
              {generating ? 'Montando seu percurso…' : 'Gerar meu percurso'}
              {!generating && <Icon name="arrow" />}
            </button>
            <p className="privacy-note"><Icon name="shield" /> Usada para calcular a rota; não é salva pelo protótipo.</p>
          </aside>

          <div className="map-column">
            <div className="map-context-row">
              <div><span className="context-label">REGIÃO SELECIONADA</span><strong>{place}</strong></div>
              {mapsApiKey && origin && <button className="map-action" onClick={centerMap} type="button"><Icon name="target" /> Centralizar</button>}
            </div>
            {mapsApiKey ? <GoogleMapPanel ref={mapRef} apiKey={mapsApiKey} routePolyline={routePolyline} onOriginChange={onOriginChange} onMapReady={onMapReady} onMapError={onMapError} /> : <DemoMap selectedRoute={selectedRoute} />}
            <div className="map-footer"><span><i className="footer-dot" /> {routePolyline ? 'Rota calculada pelo Google Maps' : generated ? 'Percurso ilustrativo selecionado' : mapsApiKey ? mapReady ? 'Mapa conectado' : 'Carregando Google Maps…' : 'Visualização demonstrativa'}</span><span>{mapsApiKey ? 'Camada de popularidade simulada' : 'Dados simulados · sem integração de mapa'}</span></div>
            {routeError && <p className="route-error" role="alert">{routeError}</p>}
            {routeNotice && <p className="route-notice" role="status">{routeNotice}</p>}
          </div>
        </section>

        <section id="community" className="recommendations-section">
          <div className="results-heading"><div><p className="eyebrow">OPÇÕES DE DEMONSTRAÇÃO</p><h2>{generated ? 'Seu percurso sugerido' : 'Explore percursos'}</h2></div></div>
          <div className="route-grid">
            {(filteredRoutes.length ? filteredRoutes : demoRoutes).map((route, index) => (
              <article className={`route-card ${selectedRouteId === route.id ? 'route-card-selected' : ''}`} key={route.id} onClick={() => setSelectedRouteId(route.id)} role="button" aria-pressed={selectedRouteId === route.id} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRouteId(route.id) } }}>
                <div className="route-card-top"><span className={`route-index index-${index + 1}`}>0{index + 1}</span><span className="popular-tag"><span /> {route.popularity}% popular</span></div>
                <h3>{route.name}</h3>
                <div className="route-stats"><div><strong>{route.id === 'r1' && liveDistance ? liveDistance.toFixed(1) : route.distance.toFixed(1)}</strong><span>KM</span></div><i /><div><strong>{route.time}</strong><span>MIN</span></div><i /><div><strong>{route.elevation}</strong><span>ELEVAÇÃO</span></div></div>
                <div className="route-card-footer"><span className="rating"><span>★</span> {route.rating.toFixed(1)} <small>({route.reviews} avaliações fictícias)</small></span></div>
              </article>
            ))}
          </div>
          <p className="results-disclaimer">Popularidade, avaliações e geometrias desta prévia são demonstrativas e não descrevem uma região real.</p>
        </section>

      </main>

      <footer className="app-footer"><span>PACEFINDER · PROJETO DE PORTFÓLIO</span><span>Rotas, atividade e avaliações demonstrativas.</span></footer>
    </div>
  )
}

export default App
