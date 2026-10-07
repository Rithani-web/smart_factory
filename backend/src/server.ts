import { createApp } from './app.ts';
import { runEscalationTick } from './escalation/evaluator.ts';
import { env } from './shared/env.ts';

const app = createApp();

// spec/002: in-process escalation evaluator (research D11) — owned by the
// server bootstrap, never started by the app factory (tests call the tick).
setInterval(() => {
  runEscalationTick().catch((err) => console.error('Escalation tick failed:', err));
}, 30_000);

app.listen(env.PORT, () => {
  console.log(`Smart Factory backend listening on http://localhost:${env.PORT}/api`);
});
