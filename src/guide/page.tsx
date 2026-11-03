// The public "How to Play" page (guide.html): the same content as the in-game guide,
// laid out as one scrolling page you can link anywhere. Works on phones.
import { render } from 'preact';
import { FAQ, GUIDE } from './content';
import { GuideCardView } from '../ui/HowToPlay';
import '../style.css';
import './page.css';

function Page() {
  return (
    <>
      <header class="gs-hero">
        <div class="gs-hero-art" />
        <div class="gs-hero-inner">
          <div class="gs-logo">BUNKR</div>
          <div class="gs-tag">the world is ending. the chart is green. get in.</div>
          <h1>How to play</h1>
          <a class="btn btn-green gs-play" href="/">PLAY NOW</a>
        </div>
      </header>
      <nav class="gs-nav">
        {GUIDE.map((s) => <a key={s.id} href={`#${s.id}`}>{s.tab}</a>)}
        <a href="#faq">FAQ</a>
      </nav>
      <main class="gs-main">
        {GUIDE.map((s) => (
          <section key={s.id} id={s.id} class="gs-section">
            <div class="gs-kicker">{s.tab}</div>
            <h2>{s.title}</h2>
            <p class="guide-intro">{s.intro}</p>
            <div class="guide-cards">{s.cards.map((c) => <GuideCardView key={c.title} card={c} />)}</div>
          </section>
        ))}
        <section id="faq" class="gs-section">
          <div class="gs-kicker">FAQ</div>
          <h2>Questions people ask</h2>
          <div class="guide-faq">
            {FAQ.map((f) => <div key={f.q} class="guide-q"><b>{f.q}</b><p>{f.a}</p></div>)}
          </div>
        </section>
      </main>
      <footer class="gs-foot">
        <a class="btn btn-green" href="/">PLAY BUNKR</a>
        <p>$BUNKR on Robinhood Chain · game contracts are testnet-only until audited · not financial advice, obviously</p>
      </footer>
    </>
  );
}

render(<Page />, document.getElementById('guide')!);
