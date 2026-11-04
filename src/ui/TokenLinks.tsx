import { useState } from 'preact/hooks';
import { LAUNCH, launched, shortAddress } from '../chain/launch';

/** Buy $BUNKR, plus the contract address with tap-to-copy. Renders nothing before launch. */
export function TokenLinks({ class: cls = '' }: { class?: string }) {
  const [copied, setCopied] = useState(false);
  if (!launched) return null;
  const ca = LAUNCH.address!;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the full address is still in the tooltip */
    }
  };
  return (
    <div class={`token-links ${cls}`}>
      {LAUNCH.buyUrl && <a class="btn btn-green tk-buy" href={LAUNCH.buyUrl} target="_blank" rel="noreferrer">BUY $BUNKR</a>}
      <button class="tk-ca" onClick={copy} title={ca}>
        <span class="tk-label">CA</span>
        <span class="tk-addr">{copied ? 'COPIED' : shortAddress(ca)}</span>
      </button>
    </div>
  );
}
