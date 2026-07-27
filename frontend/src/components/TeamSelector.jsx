import { useI18n } from '../i18n/I18nProvider'
import '../styles/TeamSelector.css'

export default function TeamSelector({ onSelect }) {
  const { t } = useI18n()

  return (
    <section className="team-pick" aria-label={t.chooseTeam}>
      <div className="team-pick__atmosphere" aria-hidden="true">
        <img src="/images/maps/de_dust2.png" alt="" draggable={false} />
        <div className="team-pick__veil" />
      </div>

      <div className="team-pick__container">
        <header className="team-pick__heading">
          <h1>{t.chooseTeam}</h1>
          <p>{t.chooseTeamHint}</p>
        </header>

        <div className="team-pick__boards">
          <button
            type="button"
            className="team-board team-board--t"
            onClick={() => onSelect('T')}
          >
            <div className="team-board__meta">
              <span className="team-board__name">{t.teamT}</span>
              <span className="team-board__tag">T</span>
            </div>

            <div className="team-board__stage">
              <span className="team-board__ring" aria-hidden="true" />
              <img
                className="team-board__agent"
                src="/images/tt.png"
                alt=""
                draggable={false}
              />
            </div>

            <span className="team-board__cta">{t.selectTeam}</span>
          </button>

          <button
            type="button"
            className="team-board team-board--ct"
            onClick={() => onSelect('CT')}
          >
            <div className="team-board__meta">
              <span className="team-board__name">{t.teamCt}</span>
              <span className="team-board__tag">CT</span>
            </div>

            <div className="team-board__stage">
              <span className="team-board__ring" aria-hidden="true" />
              <img
                className="team-board__agent"
                src="/images/ct.png"
                alt=""
                draggable={false}
              />
            </div>

            <span className="team-board__cta">{t.selectTeam}</span>
          </button>
        </div>
      </div>
    </section>
  )
}
