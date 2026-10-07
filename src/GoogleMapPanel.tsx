import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

// O carregador é global por página. Guardamos a Promise para que o StrictMode
// do React em desenvolvimento não tente configurar a mesma chave duas vezes.
let mapsLibraryPromise: Promise<google.maps.MapsLibrary> | null = null
let mapsLoaderConfigured = false

function loadMapsLibrary(apiKey: string) {
  if (!mapsLoaderConfigured) {
    setOptions({ key: apiKey, v: 'weekly', language: 'pt-BR' })
    mapsLoaderConfigured = true
  }

  if (!mapsLibraryPromise) {
    mapsLibraryPromise = importLibrary('maps') as Promise<google.maps.MapsLibrary>
  }

  return mapsLibraryPromise
}

export type Coordinates = { lat: number; lng: number }
export type SelectedPlace = Coordinates & { label: string }

export type GoogleMapHandle = {
  search: (query: string) => Promise<SelectedPlace>
  locate: () => Promise<SelectedPlace>
  focus: (coordinates: Coordinates) => void
}

/**
 * Decodifica a polyline compactada devolvida pela Routes API para coordenadas.
 * O formato armazena diferenças entre pontos em grupos de bits, por isso cada
 * latitude/longitude precisa ser reconstruída antes de desenhar a linha no mapa.
 */
function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    const deltas: number[] = []
    for (let coordinate = 0; coordinate < 2; coordinate += 1) {
      let value = 0
      let shift = 0
      let chunk: number

      do {
        if (index >= encoded.length || shift > 30) throw new Error('Polyline incompleta ou inválida')
        chunk = encoded.charCodeAt(index) - 63
        index += 1
        if (chunk < 0 || chunk > 63) throw new Error('Polyline contém um caractere inválido')
        value |= (chunk & 0x1f) << shift
        shift += 5
      } while (chunk >= 0x20)

      // O bit menos significativo guarda o sinal; os restantes guardam a magnitude.
      deltas.push(value & 1 ? ~(value >> 1) : value >> 1)
    }

    latitude += deltas[0]
    longitude += deltas[1]
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 })
  }

  return points
}

type GoogleMapPanelProps = {
  apiKey: string
  routePolyline: string | null
  onOriginChange: (place: SelectedPlace) => void
  onMapReady: (ready: boolean) => void
  onMapError: (message: string) => void
}

/**
 * Adaptador visual para Google Maps. A busca e a geolocalização ficam aqui porque
 * são operações que dependem dos serviços carregados pelo próprio mapa.
 */
const GoogleMapPanel = forwardRef<GoogleMapHandle, GoogleMapPanelProps>(function GoogleMapPanel(
  { apiKey, routePolyline, onOriginChange, onMapReady, onMapError },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const routeRef = useRef<google.maps.Polyline | null>(null)
  const hotspotCirclesRef = useRef<google.maps.Circle[]>([])
  const [error, setError] = useState('')

  const setOrigin = useCallback((coordinates: Coordinates, label: string) => {
    const map = mapRef.current
    if (!map) return
    map.setCenter(coordinates)
    map.setZoom(Math.max(map.getZoom() ?? 13, 13))
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({ map, position: coordinates, title: 'Ponto de partida' })
    } else {
      markerRef.current.setPosition(coordinates)
    }

    // Círculos servem apenas para demonstrar a camada de popularidade sintética.
    // Eles não afirmam que corredores reais passaram por esses pontos.
    hotspotCirclesRef.current.forEach((circle) => circle.setMap(null))
    hotspotCirclesRef.current = [
      { lat: 0.004, lng: 0.002, radius: 180, opacity: 0.2 },
      { lat: -0.003, lng: 0.005, radius: 260, opacity: 0.14 },
      { lat: 0.006, lng: -0.004, radius: 130, opacity: 0.24 },
    ].map((spot) => new google.maps.Circle({
      map,
      center: { lat: coordinates.lat + spot.lat, lng: coordinates.lng + spot.lng },
      radius: spot.radius,
      strokeColor: '#5f8d62',
      strokeOpacity: 0.55,
      strokeWeight: 1,
      fillColor: '#6d986f',
      fillOpacity: spot.opacity,
      clickable: false,
    }))

    onOriginChange({ ...coordinates, label })
  }, [onOriginChange])

  useEffect(() => {
    let cancelled = false

    async function initializeMap() {
      try {
        const maps = await loadMapsLibrary(apiKey)
        if (cancelled || !hostRef.current) return

        const map = new maps.Map(hostRef.current, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })
        mapRef.current = map
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return
          const coordinates = { lat: event.latLng.lat(), lng: event.latLng.lng() }
          setOrigin(coordinates, 'Ponto selecionado no mapa')
        })
        onMapReady(true)
      } catch (initializationError) {
        console.error('Não foi possível carregar o Google Maps:', initializationError)
        if (!cancelled) setError('Não foi possível carregar o Google Maps. Confira a chave e as APIs habilitadas.')
      }
    }

    void initializeMap()
    return () => {
      cancelled = true
      onMapReady(false)
      routeRef.current?.setMap(null)
      hotspotCirclesRef.current.forEach((circle) => circle.setMap(null))
    }
  }, [apiKey, onMapReady, setOrigin])

  useImperativeHandle(ref, () => ({
    async search(query) {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: query }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não encontrei esse local. Tente informar cidade e estado.')
      const selectedPlace: SelectedPlace = { lat: result.lat, lng: result.lng, label: result.label }
      setOrigin(selectedPlace, selectedPlace.label)
      return selectedPlace
    },
    async locate() {
      if (!navigator.geolocation) throw new Error('Este navegador não oferece geolocalização.')
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Não foi possível obter sua localização. Verifique a permissão do navegador.')), {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 60_000,
        })
      })
      const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude }
      setOrigin(coordinates, 'Minha localização')
      return { ...coordinates, label: 'Minha localização' }
    },
    focus(coordinates) {
      mapRef.current?.setCenter(coordinates)
      mapRef.current?.setZoom(14)
    },
  }), [setOrigin])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    routeRef.current?.setMap(null)
    if (!routePolyline) return
    try {
      const path = decodePolyline(routePolyline)
      routeRef.current = new google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: '#315d3b',
        strokeOpacity: 0.95,
        strokeWeight: 5,
      })
      const bounds = new google.maps.LatLngBounds()
      path.forEach((point) => bounds.extend(point))
      map.fitBounds(bounds, 54)
    } catch (decodeError) {
      console.error('A geometria devolvida pela rota não pôde ser exibida:', decodeError)
      onMapError('A rota foi recebida, mas não pôde ser desenhada no mapa.')
    }
  }, [routePolyline, onMapError])

  return (
    <section className="map-panel google-map-panel" aria-label="Mapa interativo do Google Maps">
      <div className="google-map-surface" ref={hostRef} />
      <div className="map-topline map-overlay">
        <div className="map-location"><span className="live-dot" /><span>GOOGLE MAPS</span></div>
      </div>
      <div className="map-legend map-overlay"><span className="legend-title">ATIVIDADE SIMULADA</span><div className="legend-scale"><span>Menos</span><i /><i /><i /><span>Mais</span></div></div>
      <div className="google-map-notice">Áreas de atividade são fictícias para esta demonstração.</div>
      {error && <div className="map-error" role="alert">{error}</div>}
    </section>
  )
})

export default GoogleMapPanel
