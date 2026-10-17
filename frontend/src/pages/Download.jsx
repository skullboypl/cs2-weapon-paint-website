import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Monitor } from 'lucide-react'
import Brand from '../components/Brand'
import { LangDropdown } from '../components/HeaderMenus'
import { useI18n } from '../i18n/useI18n'
import '../styles/Download.css'

export default function Download() {
  const { locale } = useI18n()
  const pl = locale === 'pl'
  const title = pl ? 'Aplikacja CloudHub — wkrótce' : 'CloudHub app — coming soon'
  useEffect(() => {
    const previous = document.title
    document.title = `${title} | CloudHub CS2`
    return () => { document.title = previous }
  }, [title])

  return (
    <div className="ch-landing ch-download-page">
      <header className="ch-landing-nav">
        <Link to="/" aria-label="CloudHub CS2"><Brand /></Link>
        <LangDropdown compact />
      </header>
      <main className="ch-download-main">
        <div className="ch-download-icon" aria-hidden="true"><Monitor size={48} strokeWidth={1.5} /></div>
        <span className="ch-eyebrow">CLOUDHUB DESKTOP · WINDOWS</span>
        <h1>{title}</h1>
        <p>{pl
          ? 'CloudHub Desktop planujemy po ukończeniu strony i backendu. Aplikacja nie jest jeszcze dostępna do pobrania.'
          : 'CloudHub Desktop is planned after the website and backend are complete. The app is not available to download yet.'}</p>
        <p className="ch-download-future">{pl
          ? 'Docelowo: to samo konto Steam, profile, znajomi, ranking, Cloud Coins, sklep i konfigurator skinów — także na Windows.'
          : 'Planned: the same Steam account, profiles, friends, rankings, Cloud Coins, shop and skin customizer — also on Windows.'}</p>
        <Link to="/" className="ch-primary">
          {pl ? 'Korzystaj z CloudHub w przeglądarce' : 'Use CloudHub in your browser'}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </main>
      <footer className="ch-download-footer">CloudHub CS2 · {pl ? 'Jedno konto. Wspólny postęp.' : 'One account. Shared progress.'}</footer>
    </div>
  )
}
