/** The results server didn't answer when a ticketed run was starting. The ticket is kept. */
export function ServerProblem({ message }: { message: string }) {
  return (
    <div class="phone-gate">
      <div class="pg-card">
        <img class="pg-hatch" src="/art/hatch/panic.webp" alt="" draggable={false} />
        <div class="pg-kicker">HATCH · BUNKER OS</div>
        <div class="pg-title">THE RESULTS SERVER IS DOWN</div>
        <p>{message}</p>
        <p class="pg-dim">Your Ration Ticket is safe. This run starts as soon as the server answers.</p>
        <button class="btn btn-green pg-btn" onClick={() => location.reload()}>TRY AGAIN</button>
        <button class="pg-anyway" onClick={() => (location.search = '')}>back to the title screen</button>
      </div>
    </div>
  );
}
