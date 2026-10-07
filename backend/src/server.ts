import { createApp } from './app.ts';
import { env } from './shared/env.ts';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Smart Factory backend listening on http://localhost:${env.PORT}/api`);
});
