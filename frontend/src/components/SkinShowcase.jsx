import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import '../styles/SkinShowcase.css'

/** Curated iconic skins - IDs matched to public/data/skins_en.json */
const FEATURED = [
  {
    paint_name: 'AK-47 | Inheritance',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_ak47-1171.png',
  },
  {
    paint_name: 'AWP | Asiimov',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_awp-279.png',
  },
  {
    paint_name: 'M4A1-S | Printstream',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_m4a1_silencer-984.png',
  },
  {
    paint_name: 'Karambit | Doppler',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_knife_karambit-417.png',
  },
  {
    paint_name: 'Desert Eagle | Printstream',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_deagle-962.png',
  },
  {
    paint_name: 'AK-47 | Asiimov',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_ak47-801.png',
  },
  {
    paint_name: 'USP-S | Kill Confirmed',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_usp_silencer-504.png',
  },
  {
    paint_name: 'Glock-18 | Fade',
    image:
      'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_glock-38.png',
  },
]

const INTERVAL_MS = 3200

export default function SkinShowcase() {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(() => new Set([0]))

  useEffect(() => {
    FEATURED.forEach((skin, i) => {
      const img = new Image()
      img.onload = () => {
        setReady((prev) => {
          const next = new Set(prev)
          next.add(i)
          return next
        })
      }
      img.src = skin.image
    })
  }, [])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined
    const id = setInterval(() => {
      setIndex((i) => {
        for (let step = 1; step <= FEATURED.length; step += 1) {
          const next = (i + step) % FEATURED.length
          if (ready.has(next)) return next
        }
        return i
      })
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [ready])

  return (
    <div className="skin-showcase" aria-label={t.skinShowcaseLabel}>
      <div className="skin-showcase__stage">
        <span className="skin-showcase__glow" aria-hidden="true" />
        {FEATURED.map((skin, i) => {
          const active = i === index && ready.has(i)
          return (
            <div
              key={skin.image}
              className={active ? 'skin-showcase__slide is-active' : 'skin-showcase__slide'}
              aria-hidden={!active}
            >
              <img
                className="skin-showcase__img"
                src={skin.image}
                alt=""
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          )
        })}
        <div className="skin-showcase__floor" aria-hidden="true" />
      </div>

      <div className="skin-showcase__meta">
        <span className="skin-showcase__eyebrow">{t.skinShowcaseLabel}</span>
        <div className="skin-showcase__caption">
          {FEATURED.map((skin, i) => (
            <strong
              key={skin.paint_name}
              className={
                i === index ? 'skin-showcase__name is-active' : 'skin-showcase__name'
              }
            >
              {skin.paint_name}
            </strong>
          ))}
        </div>
        <div className="skin-showcase__dots" aria-hidden="true">
          {FEATURED.map((_, i) => (
            <span
              key={i}
              className={i === index ? 'skin-showcase__dot is-active' : 'skin-showcase__dot'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
