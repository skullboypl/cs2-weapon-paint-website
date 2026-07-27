import { useI18n } from '../i18n/I18nProvider'
import '../styles/LoadingScreen.css'

/** Falling loot bits - same curated skins as login showcase + cash chips */
const FALLING = [
  {
    kind: 'skin',
    src: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_ak47-1171.png',
    x: 8,
    delay: 0,
    dur: 7.2,
    size: 78,
    rot: -18,
  },
  {
    kind: 'cash',
    label: '$',
    x: 22,
    delay: 1.1,
    dur: 6.4,
    size: 28,
    rot: 12,
  },
  {
    kind: 'skin',
    src: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_awp-279.png',
    x: 36,
    delay: 0.4,
    dur: 8.1,
    size: 92,
    rot: 8,
  },
  {
    kind: 'cash',
    label: '€',
    x: 48,
    delay: 2.2,
    dur: 5.8,
    size: 24,
    rot: -8,
  },
  {
    kind: 'skin',
    src: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_knife_karambit-417.png',
    x: 58,
    delay: 1.6,
    dur: 7.6,
    size: 70,
    rot: 22,
  },
  {
    kind: 'cash',
    label: '$',
    x: 70,
    delay: 0.7,
    dur: 6.9,
    size: 32,
    rot: 16,
  },
  {
    kind: 'skin',
    src: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_deagle-962.png',
    x: 78,
    delay: 2.8,
    dur: 7.0,
    size: 74,
    rot: -12,
  },
  {
    kind: 'cash',
    label: '¥',
    x: 14,
    delay: 3.4,
    dur: 6.2,
    size: 22,
    rot: -20,
  },
  {
    kind: 'skin',
    src: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_m4a1_silencer-984.png',
    x: 88,
    delay: 1.9,
    dur: 8.4,
    size: 86,
    rot: 6,
  },
  {
    kind: 'cash',
    label: '$',
    x: 42,
    delay: 4.1,
    dur: 5.5,
    size: 26,
    rot: 24,
  },
  {
    kind: 'skin',
    src: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_glock-38.png',
    x: 28,
    delay: 3.6,
    dur: 7.8,
    size: 64,
    rot: -6,
  },
  {
    kind: 'cash',
    label: '₴',
    x: 92,
    delay: 0.2,
    dur: 6.6,
    size: 24,
    rot: 10,
  },
]

export default function LoadingScreen() {
  const { t } = useI18n()

  return (
    <div className="wp-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="wp-loading__bg" aria-hidden />
      <div className="wp-loading__veil" aria-hidden />

      <div className="wp-loading__rain" aria-hidden>
        {FALLING.map((item, i) => (
          <span
            key={`${item.kind}-${i}`}
            className={
              item.kind === 'cash' ? 'wp-loading__bit wp-loading__bit--cash' : 'wp-loading__bit'
            }
            style={{
              left: `${item.x}%`,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.dur}s`,
              '--bit-size': `${item.size}px`,
              '--bit-rot': `${item.rot}deg`,
            }}
          >
            {item.kind === 'skin' ? (
              <img src={item.src} alt="" draggable={false} />
            ) : (
              <em>{item.label}</em>
            )}
          </span>
        ))}
      </div>

      <div className="wp-loading__card">
        <img
          className="wp-loading__emblem"
          src="/images/wp-emblem.svg"
          width={52}
          height={52}
          alt=""
          draggable={false}
        />
        <p className="wp-loading__brand">{t.brand}</p>
        <div className="wp-loading__bar" aria-hidden>
          <span />
        </div>
        <p className="wp-loading__text">{t.loading}</p>
      </div>
    </div>
  )
}
