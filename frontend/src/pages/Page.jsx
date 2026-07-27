import { useEffect, useState } from 'react'
import TeamSelector from '../components/TeamSelector'
import Weapons from '../components/Weapons'
import LoadoutsPanel from '../components/LoadoutsPanel'
import {
  HeaderUserMenu,
  LangDropdown,
  TeamSwitcher,
} from '../components/HeaderMenus'
import { useI18n } from '../i18n/I18nProvider'
import { apiUrl } from '../lib/api'
import { prefetchWeaponCatalogs } from '../lib/dataCache'
import SiteFooter from '../components/SiteFooter'
import '../styles/Page.css'

export default function Page({ user, team, setTeam, category, setCategory }) {
  const { t } = useI18n()
  const [weaponsKey, setWeaponsKey] = useState(0)

  useEffect(() => {
    document.body.classList.add('skinspage')
    document.body.classList.remove('login-page')
    return () => document.body.classList.remove('skinspage')
  }, [])

  useEffect(() => {
    const idle = () => {
      prefetchWeaponCatalogs()
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(idle, { timeout: 800 })
      return () => cancelIdleCallback?.(id)
    }
    const tmr = setTimeout(idle, 100)
    return () => clearTimeout(tmr)
  }, [])

  const handleLogout = () => {
    window.location.href = apiUrl('steamauth/logout.php')
  }

  return (
    <div className={team ? 'app-shell' : 'app-shell app-shell--pick'}>
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <div className="app-topbar__left">
            <img
              className="app-topbar__emblem"
              src="/images/wp-emblem.svg"
              width={34}
              height={34}
              alt=""
              draggable={false}
            />
            <span className="app-topbar__brand">{t.brand}</span>
            {team && (
              <TeamSwitcher
                team={team}
                onSelect={setTeam}
                onBack={() => setTeam(null)}
              />
            )}
          </div>

          <div className="app-topbar__right">
            {team && (
              <LoadoutsPanel
                team={team}
                onApplied={() => setWeaponsKey((k) => k + 1)}
              />
            )}
            <LangDropdown />
            <HeaderUserMenu user={user} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      <main className="app-main">
        {team ? (
          <div className="app-weapons">
            <Weapons
              key={`${team}-${weaponsKey}`}
              team={team}
              category={category}
              onCategoryChange={setCategory}
            />
          </div>
        ) : (
          <TeamSelector onSelect={setTeam} />
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
