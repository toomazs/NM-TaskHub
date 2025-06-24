import { createClient } from '@supabase/supabase-js';

// Essas chaves são públicas da DB. Não há perigos em mantê-las aqui. Tudo de secreto está em uma .env
const SUPABASE_URL = 'https://lzjunqtkldknjynsyhbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6anVucXRrbGRrbmp5bnN5aGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMDQ0NjksImV4cCI6MjA2NTc4MDQ2OX0.wEN5Y4ls43fQOjHtLjTv85GuIEdFRR5mL5HD4ZTNBTc';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);