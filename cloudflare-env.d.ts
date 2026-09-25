declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GROQ_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GROQ_MODEL?: string;
    GEMINI_MODEL?: string;
    BRUNAFLOW_AI_PROVIDER_ORDER?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REFRESH_TOKEN?: string;
    GMAIL_SENDER?: string;
    BRUNAFLOW_WEBHOOK_SECRET?: string;
    OAUTH_ENCRYPTION_KEY?: string;
  }
}
