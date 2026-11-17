import { useState } from 'preact/hooks';

/** Phones: the bunker needs a bigger screen. Tablets (short side 600px and up) play. */
export function isPhone(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && Math.min(screen.width, screen.height) < 600;
}

const KEY = 'bunkr.phoneAnyway';

export function phoneOverride(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Phone players get HATCH telling them to find a bigger screen. */
export function PhoneGate({ onAnyway }: { onAnyway: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div class="phone-gate">
      <div class="pg-card">
        <img class="pg-hatch" src="/art/hatch/cry.webp" alt="" draggable={false} />
        <div class="pg-kicker">HATCH · BUNKER OS</div>
        <div class="pg-title">THIS BUNKER NEEDS A <span class="nowrap">BIGGER SCREEN</span></div>
        <p>
          Your phone is not rated for nuclear winter. I ran the numbers: six rooms, fourteen degens and one mutant whale
          do not fit on the same screen you check charts on in the bathroom.
        </p>
        <p class="pg-dim">Play on a computer or a tablet. The apocalypse will wait. (It will not.)</p>
        <a class="btn btn-amber pg-btn" href="/guide.html">SEE HOW IT PLAYS</a>
        <button class="btn btn-green pg-btn" onClick={copy}>{copied ? 'LINK COPIED' : 'COPY LINK FOR LATER'}</button>
        <button
          class="pg-anyway"
          onClick={() => {
            try {
              sessionStorage.setItem(KEY, '1');
            } catch {
              /* ignore */
            }
            onAnyway();
          }}
        >
          i like pain, let me in anyway
        </button>
      </div>
    </div>
  );
}
