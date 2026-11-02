import { useState } from 'preact/hooks';

/** Phones and small touch screens: the in-game UI isn't built for them yet. */
export function isPhone(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && Math.min(screen.width, screen.height) < 820;
}

const KEY = 'bunkr.phoneAnyway';

export function phoneOverride(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Until the real mobile version ships, phone players get HATCH telling them to find a computer. */
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
        <div class="pg-title">THIS BUNKER IS <span class="nowrap">PC-ONLY</span></div>
        <p>
          Your phone is not rated for nuclear winter. I ran the numbers: six rooms, fourteen degens and one mutant whale
          do not fit on the same screen you check charts on in the bathroom.
        </p>
        <p class="pg-dim">Grab a laptop or desktop and come back. The apocalypse will wait. (It will not.)</p>
        <button class="btn btn-green pg-btn" onClick={copy}>{copied ? 'LINK COPIED' : 'COPY LINK FOR LATER'}</button>
        <div class="pg-foot">Mobile bunker is under construction.</div>
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
