import { config as loadDotenv } from 'dotenv';

loadDotenv();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get DATABASE_URL(): string {
    return required('DATABASE_URL');
  },
  get TEST_DATABASE_URL(): string | undefined {
    return process.env.TEST_DATABASE_URL;
  },
  get JWT_ACCESS_SECRET(): string {
    return required('JWT_ACCESS_SECRET');
  },
  get JWT_REFRESH_SECRET(): string {
    return required('JWT_REFRESH_SECRET');
  },
  get RESEND_API_KEY(): string {
    return process.env.RESEND_API_KEY ?? '';
  },
  get MAIL_FROM(): string {
    return process.env.MAIL_FROM ?? 'Smart Factory <onboarding@resend.dev>';
  },
  get PORT(): number {
    return Number(process.env.PORT ?? 3000);
  },
};
