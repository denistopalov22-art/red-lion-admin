import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vumvxkqwkaiknilkoyzj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1bXZ4a3F3a2Fpa25pbGtveXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODM4MTMsImV4cCI6MjA5NzI1OTgxM30.XjQRdwmF7CfdrVu_Z23ZScK3F6MwU6wm4agSVp1p9SA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
} );
