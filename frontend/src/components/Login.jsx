import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Layers,
  Crosshair,
  Monitor,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles/Download.css";
import { useI18n } from "../i18n/useI18n";
import { apiUrl } from "../lib/api";
import { cloudhubCopy } from "../lib/cloudhubCopy";
import { LangDropdown } from "./HeaderMenus";
import Brand from "./Brand";
import SiteFooter from "./SiteFooter";

export default function Login() {
  const { locale } = useI18n();
  const c = cloudhubCopy(locale);
  const failed =
    new URLSearchParams(window.location.search).get("login") === "failed";
  return (
    <div className="ch-landing">
      <header className="ch-landing-nav">
        <a href="/" aria-label="CloudHub CS2">
          <Brand />
        </a>
        <div>
          <Link className="ch-download-link" to="/download"><Monitor size={16} aria-hidden="true" />{c.download}</Link>
          <a className="ch-nav-link" href="#experience">
            {c.help} <ArrowUpRight size={14} />
          </a>
          <LangDropdown compact />
        </div>
      </header>
      <main>
        <section className="ch-login-hero">
          <div className="ch-login-copy">
            <span className="ch-eyebrow">
              <span className="ch-dot" /> {c.badge}
            </span>
            <h1>
              {c.loginTitle.split("\n")[0]}
              <br />
              <span>{c.loginTitle.split("\n")[1]}</span>
            </h1>
            <p>{c.loginSub}</p>
            {failed && (
              <p className="ch-error" role="alert">
                {c.loginError}
              </p>
            )}
            <a className="ch-primary ch-steam" href={apiUrl("login-steam.php")}>
              <img src="/images/Steam_icon_logo.svg" alt="" />
              {c.steam}
              <ArrowRight size={19} />
            </a>
            <span className="ch-secure">
              <ShieldCheck size={15} />
              {c.secure}
            </span>
            <div className="ch-login-tags">
              <span>WEAPONPAINTS</span>
              <span>STATTRAK™</span>
              <span>T + CT</span>
            </div>
          </div>
          <div
            className="ch-showroom"
            aria-label="AWP Asiimov, AK-47 Inheritance, Karambit Doppler"
          >
            <div className="ch-orbit ch-orbit-one" />
            <div className="ch-orbit ch-orbit-two" />
            <span className="ch-showroom-label">BUILT DIFFERENT.</span>
            <article className="ch-showcase-main">
              <span className="ch-rarity">COVERT COLLECTION</span>
              <img src="/images/cloudhub/awp-asiimov.png" alt="AWP Asiimov" />
              <div>
                <span>AWP</span>
                <strong>Asiimov</strong>
                <span className="ch-showcase-mark">01 / 03</span>
              </div>
            </article>
            <article className="ch-showcase-small ch-showcase-ak">
              <img
                src="/images/cloudhub/ak-inheritance.png"
                alt="AK-47 Inheritance"
              />
              <div>
                <span>AK-47</span>
                <strong>Inheritance</strong>
              </div>
            </article>
            <article className="ch-showcase-small ch-showcase-knife">
              <img
                src="/images/cloudhub/karambit-doppler.png"
                alt="Karambit Doppler"
              />
              <div>
                <span>★ KARAMBIT</span>
                <strong>Doppler</strong>
              </div>
            </article>
            <span className="ch-showroom-caption">
              <Crosshair size={14} /> COUNTER-STRIKE 2 / PERSONAL LOADOUT
            </span>
          </div>
        </section>
        <section className="ch-experience" id="experience">
          <div className="ch-section-heading">
            <span className="ch-eyebrow">THE DETAILS MAKE THE DIFFERENCE</span>
            <h2>{c.explore}</h2>
          </div>
          <div className="ch-feature-grid">
            {[
              [SlidersHorizontal, c.detail, c.detailSub],
              [Layers, c.teams, c.teamsSub],
              [Crosshair, c.sync, c.syncSub],
            ].map(([Icon, title, description], i) => (
              <article key={title}>
                <span className="ch-feature-icon">
                  {Icon && <Icon size={23} />}
                </span>
                <span className="ch-feature-number">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <p className="ch-legal">{c.legal}</p>
        </section>
      </main>
      <SiteFooter variant="login" />
    </div>
  );
}
