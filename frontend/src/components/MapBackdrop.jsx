import { useEffect, useState } from 'react'

/** Crossfade pełnych grafik map CS2 - bez podpisów. */
const SLIDES = [
  { id: 'mirage', src: '/images/De_mirage_cs2.webp' },
  { id: 'dust2', src: '/images/maps/de_dust2.png' },
  { id: 'inferno', src: '/images/maps/de_inferno.png' },
  { id: 'nuke', src: '/images/maps/de_nuke.png' },
  { id: 'ancient', src: '/images/maps/de_ancient.png' },
]

const INTERVAL_MS = 7000

export default function MapBackdrop() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length)
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="map-backdrop" aria-hidden="true">
      {SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className={
            i === index
              ? 'map-backdrop__slide is-active'
              : 'map-backdrop__slide'
          }
          style={{ backgroundImage: `url(${slide.src})` }}
        />
      ))}
      <div className="map-backdrop__dim" />
      <div className="map-backdrop__scan" />
    </div>
  )
}
