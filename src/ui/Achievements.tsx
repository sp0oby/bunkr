import { useEffect, useState } from 'preact/hooks';
import { ACHIEVEMENTS, type AchId } from '../sim/achievements';
import { loadAch } from '../achievements';
import { fetchAchievements } from '../chain/server';
import { useWallet } from '../chain/wallet';

type Earned = Partial<Record<AchId, number>>;

/** This browser's achievements plus the connected wallet's verified ones. */
function useAchievements(): { local: Earned; verified: Earned | null } {
  const w = useWallet();
  const [verified, setVerified] = useState<Earned | null>(null);
  useEffect(() => {
    if (w.status !== 'connected' || !w.address) return setVerified(null);
    void fetchAchievements(w.address).then(setVerified);
  }, [w.status, w.address]);
  return { local: loadAch(), verified };
}

/** Title-screen card, under the Stonk Exchange. */
export function AchButton({ onOpen }: { onOpen: () => void }) {
  const { local, verified } = useAchievements();
  const n = ACHIEVEMENTS.filter((a) => local[a.id] != null || verified?.[a.id] != null).length;
  return (
    <button class="ach-tease" onClick={onOpen} title="Achievements">
      <span class="ach-tease-count">{n}<small>/{ACHIEVEMENTS.length}</small></span>
      <span>
        <b>ACHIEVEMENTS</b>
        <small>{n ? 'Verified on the results server' : 'Finish a run to start'}</small>
      </span>
    </button>
  );
}

export function AchModal({ onClose }: { onClose: () => void }) {
  const { local, verified } = useAchievements();
  const w = useWallet();
  const n = ACHIEVEMENTS.filter((a) => local[a.id] != null || verified?.[a.id] != null).length;
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal ach" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">ACHIEVEMENTS</div>
        <div class="vault-sub">
          {n}/{ACHIEVEMENTS.length} earned. Ticketed runs are replayed on the results server, so a
          <b class="ach-ok"> ✓ </b>means it's on your wallet's record for good.
          {w.status !== 'connected' && ' Connect a wallet to see your verified record.'}
        </div>
        <div class="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const got = local[a.id] != null || verified?.[a.id] != null;
            const ok = verified?.[a.id] != null;
            const hidden = a.secret && !got;
            return (
              <div key={a.id} class={`ach-cell ${got ? 'got' : ''}`}>
                <b>{hidden ? '???' : a.name}{ok && <span class="ach-ok" title="Verified by the results server"> ✓</span>}</b>
                <small>{hidden ? 'Secret. Some doors only open from the inside.' : a.desc}</small>
              </div>
            );
          })}
        </div>
        <button class="btn btn-dark card-ok" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}
