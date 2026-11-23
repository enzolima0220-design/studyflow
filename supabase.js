
const SUPABASE_URL = 'https://zpptwdtvmzawptxkzxss.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_ulRTipqDkY3yKQNYH8-O2Q_PYfBz5Gp';

export const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

