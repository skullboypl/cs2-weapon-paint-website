import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  LayoutGrid,
  Layers,
  UserRound,
  CircleHelp,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import TeamSelector from "../components/TeamSelector";
import Weapons from "../components/Weapons";
import LoadoutsPanel from "../components/LoadoutsPanel";
import { HeaderUserMenu, LangDropdown } from "../components/HeaderMenus";
import { useI18n } from "../i18n/useI18n";
import { cloudhubCopy } from "../lib/cloudhubCopy";
import { logout } from "../lib/session";
import { prefetchWeaponCatalogs } from "../lib/dataCache";
import { CATEGORY_ORDER, CATEGORY_THUMB } from "../lib/weaponDisplay";
import Brand from "../components/Brand";
import SiteFooter from "../components/SiteFooter";

const CATEGORY_KEYS = {
  Loadout: "catLoadout",
  Rifle: "catRifle",
  Sniper: "catSniper",
  PM: "catPM",
  Shotgun: "catShotgun",
  "Machine Gun": "catMachineGun",
  Pistol: "catPistol",
  Knife: "catKnife",
  Other: "catOther",
};
export default function Page({ user, team, setTeam, category, setCategory }) {
  const { t, locale } = useI18n();
  const c = cloudhubCopy(locale);
  const [weaponsKey, setWeaponsKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [view, setView] = useState("arsenal");
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 800px)").matches,
  );
  const sidebarRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 800px)");
    const update = () => setMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    prefetchWeaponCatalogs();
  }, []);
  useEffect(() => {
    if (!mobileOpen || !mobile) return;
    const previous = document.body.style.overflow;
    const menuButton = menuRef.current;
    document.body.style.overflow = "hidden";
    const controls = () =>
      [...sidebarRef.current.querySelectorAll("a, button")].filter(
        (el) => el.getClientRects().length,
      );
    controls()[0]?.focus();
    const handleKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
      if (e.key !== "Tab") return;
      const nodes = controls(),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKey);
      menuButton?.focus();
    };
  }, [mobileOpen, mobile]);
  const selectCategory = (cat) => {
    setView("arsenal");
    setMobileOpen(false);
    if (!team) {
      try {
        localStorage.setItem("wp_last_category", cat);
      } catch {
        /* optional preference */
      }
      setTeam("T");
    } else setCategory(cat);
  };
  const changeTeam = (next) => {
    setView("arsenal");
    setTeam(next);
  };
  return (
    <div className="ch-dashboard">
      <a className="ch-skip" href="#main-content">
        {c.arsenal}
      </a>
      {mobileOpen && (
        <button
          className="ch-nav-overlay"
          aria-label={t.menuClose}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        inert={mobile && !mobileOpen}
        className={`ch-sidebar ${mobileOpen ? "is-open" : ""}`}
      >
        <a className="ch-sidebar-brand" href="/">
          <Brand />
        </a>
        <button
          className="ch-sidebar-close"
          onClick={() => setMobileOpen(false)}
          aria-label={t.menuClose}
        >
          <X />
        </button>
        <div className="ch-workspace-label">
          <span className="ch-workspace-icon">
            <Crosshair size={19} />
          </span>
          <div>
            Counter-Strike 2<small>{c.studio}</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav aria-label={c.arsenal}>
          <p className="ch-nav-caption">{c.collection}</p>
          <button
            className={`ch-nav-item ${view === "arsenal" && category === "Loadout" ? "is-active" : ""}`}
            onClick={() => selectCategory("Loadout")}
          >
            <LayoutGrid size={18} />
            {c.loadout}
          </button>
          <div className="ch-nav-divider" />
          {CATEGORY_ORDER.filter((cat) => cat !== "Loadout").map((cat) => (
            <button
              key={cat}
              className={`ch-nav-item ${view === "arsenal" && team && category === cat ? "is-active" : ""}`}
              onClick={() => selectCategory(cat)}
            >
              <img src={CATEGORY_THUMB[cat]} alt="" />
              {t[CATEGORY_KEYS[cat]]}
              <ChevronRight size={14} className="ch-nav-arrow" />
            </button>
          ))}
          <p className="ch-nav-caption">{c.account}</p>
          <button
            className={`ch-nav-item ${view === "profile" ? "is-active" : ""}`}
            onClick={() => {
              setView("profile");
              setMobileOpen(false);
            }}
          >
            <UserRound size={18} />
            {c.profile}
          </button>
          <button
            className={`ch-nav-item ${view === "help" ? "is-active" : ""}`}
            onClick={() => {
              setView("help");
              setMobileOpen(false);
            }}
          >
            <CircleHelp size={18} />
            {c.help}
          </button>
        </nav>
        <div className="ch-sidebar-bottom">
          <div className="ch-community">
            <Layers size={22} />
            <strong>MAKE IT YOURS.</strong>
            <p>{c.teamsSub}</p>
          </div>
          <div className="ch-sidebar-version">
            <span className="ch-dot" /> CloudHub CS2 <span>1.0</span>
          </div>
        </div>
      </aside>
      <div className="ch-content">
        <header className="ch-topbar">
          <div className="ch-breadcrumb">
            <button
              ref={menuRef}
              className="ch-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label={c.menu}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "profile"
                ? c.profile
                : view === "help"
                  ? c.help
                  : c.arsenal}
            </strong>
          </div>
          <div className="ch-topbar-actions">
            <LangDropdown compact />
            <HeaderUserMenu user={user} onLogout={logout} />
          </div>
        </header>
        <main id="main-content" className="ch-main">
          {view === "arsenal" && (
            <>
              <div className="ch-page-heading">
                <div>
                  <p>
                    {c.welcome} <strong>{user.personaname || "Player"}</strong>
                  </p>
                  <h1>
                    {c.arsenal}
                    <span className="ch-title-dot">.</span>
                  </h1>
                </div>
                {team && (
                  <LoadoutsPanel
                    team={team}
                    onApplied={() => setWeaponsKey((k) => k + 1)}
                  />
                )}
              </div>
              {team ? (
                <>
                  <section className="ch-dashboard-hero">
                    <div>
                      <span className="ch-eyebrow">
                        YOUR LOADOUT, REIMAGINED
                      </span>
                      <h2>{c.hero}</h2>
                      <p>{c.heroSub}</p>
                      <button
                        className="ch-text-button"
                        onClick={() => selectCategory("Loadout")}
                      >
                        {c.loadout}
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="ch-hero-art">
                      <span>INHERITANCE</span>
                      <img
                        src="/images/cloudhub/ak-inheritance.png"
                        alt="AK-47 Inheritance"
                      />
                    </div>
                  </section>
                  <div className="ch-loadout-bar">
                    <div>
                      <span className="ch-dot" />
                      <span>{c.team}</span>
                    </div>
                    <div className="ch-team-toggle" aria-label={t.chooseTeam}>
                      {["T", "CT"].map((next) => (
                        <button
                          key={next}
                          aria-pressed={team === next}
                          className={team === next ? "is-active" : ""}
                          onClick={() => changeTeam(next)}
                        >
                          <span className={`ch-team-dot ch-team-dot-${next}`} />
                          {next === "T" ? t.teamT : t.teamCt}
                          <small>{next}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Weapons
                    key={`${team}-${weaponsKey}`}
                    team={team}
                    category={category}
                    onCategoryChange={selectCategory}
                  />
                </>
              ) : (
                <TeamSelector onSelect={changeTeam} />
              )}
            </>
          )}
          {view === "profile" && (
            <section className="ch-account-page">
              <span className="ch-eyebrow">{c.status}</span>
              <h1>{c.profile}</h1>
              <div className="ch-profile-card">
                <img
                  src={user.avatar || "/images/cloudhub/avatar.svg"}
                  alt=""
                />
                <div>
                  <span className="ch-secure">
                    <ShieldCheck size={15} />
                    {c.connected}
                  </span>
                  <h2>{user.personaname || "Player"}</h2>
                  <code>{user.steamid}</code>
                  <a
                    href={`https://steamcommunity.com/profiles/${user.steamid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.viewSteamProfile}
                    <ArrowUpRight size={17} />
                  </a>
                </div>
              </div>
              <p>{c.legal}</p>
              <button className="ch-primary" onClick={() => setView("arsenal")}>
                {c.back}
              </button>
            </section>
          )}
          {view === "help" && (
            <section className="ch-account-page">
              <span className="ch-eyebrow">CLOUDHUB / GUIDE</span>
              <h1>{c.helpTitle}</h1>
              <div className="ch-help-steps">
                {c.steps.map((step, i) => (
                  <article key={step}>
                    <span>0{i + 1}</span>
                    <p>{step}</p>
                  </article>
                ))}
              </div>
              <p>{c.legal}</p>
              <button className="ch-primary" onClick={() => setView("arsenal")}>
                {c.back}
              </button>
            </section>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
