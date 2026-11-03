import { useState } from 'preact/hooks';
import { FAQ, GUIDE, type GuideCard } from '../guide/content';
import { Rich } from './icons';

export function GuideCardView({ card }: { card: GuideCard }) {
  return (
    <div class={`guide-card ${card.art ? 'has-art' : ''}`}>
      {card.art && (
        // Characters and HATCH show whole; scenes fill the frame.
        <span class={`guide-art ${/^(hatch|sprites)\//.test(card.art) ? 'fit' : ''}`} style={{ backgroundImage: `url(/art/${card.art})` }} />
      )}
      <b><Rich text={card.title} size={18} /></b>
      <p><Rich text={card.body} size={16} /></p>
    </div>
  );
}

/** The in-game guide: one tab per topic, short cards, HATCH's voice. */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(GUIDE[0].id);
  const faq = tab === 'faq';
  const sec = GUIDE.find((s) => s.id === tab);
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal guide" onClick={(e) => e.stopPropagation()}>
        <div class="guide-head">
          <div class="modal-title">HOW TO PLAY</div>
          <button class="btn btn-amber guide-tut" onClick={() => (location.search = '?play=1&tutorial=1')}>PLAY THE TUTORIAL</button>
          <a class="guide-full" href="/guide.html" target="_blank" rel="noreferrer">full guide page</a>
          <button class="x big" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div class="guide-body">
          <nav class="guide-tabs">
            {GUIDE.map((s) => (
              <button key={s.id} class={tab === s.id ? 'on' : ''} onClick={() => setTab(s.id)}>{s.tab}</button>
            ))}
            <button class={faq ? 'on' : ''} onClick={() => setTab('faq')}>FAQ</button>
          </nav>
          <div class="guide-page scroll" key={tab}>
            {sec && (
              <>
                <h2>{sec.title}</h2>
                <p class="guide-intro">{sec.intro}</p>
                <div class="guide-cards">
                  {sec.cards.map((c) => <GuideCardView key={c.title} card={c} />)}
                </div>
              </>
            )}
            {faq && (
              <>
                <h2>Questions people ask</h2>
                <div class="guide-faq">
                  {FAQ.map((f) => (
                    <div key={f.q} class="guide-q"><b>{f.q}</b><p>{f.a}</p></div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
