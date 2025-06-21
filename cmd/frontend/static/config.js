// supabase config publics (nao ha problemas deixar aq pois sao publicas xD)
export const SUPABASE_URL = 'https://lzjunqtkldknjynsyhbi.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6anVucXRrbGRrbmp5bnN5aGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMDQ0NjksImV4cCI6MjA2NTc4MDQ2OX0.wEN5Y4ls43fQOjHtLjTv85GuIEdFRR5mL5HD4ZTNBTc';
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// mapeamento global de nome
export const userDisplayNameMap = {
    'eduardo@kanban.local': 'Eduardo Tomaz', 'alison@kanban.local': 'Alison Silva',
    'marques@kanban.local': 'Gabriel Marques', 'rosa@kanban.local': 'Gabriel Rosa',
    'miyake@kanban.local': 'João Miyake', 'gomes@kanban.local': 'João Gomes',
    'rodrigo@kanban.local': 'Rodrigo Akira', 'rubens@kanban.local': 'Rubens Leite',
    'kaiky@kanban.local': 'Kaiky Leandro', 'pedro@kanban.local': 'Pedro Santos',
};

// mapeamento global de nome p modal
export const userDisplayNameModalMap = {
    'eduardo@kanban.local': 'Eduardo', 'alison@kanban.local': 'Alison',
    'marques@kanban.local': 'Marques', 'rosa@kanban.local': 'Rosa',
    'miyake@kanban.local': 'Miyake', 'gomes@kanban.local': 'Gomes',
    'rodrigo@kanban.local': 'Rodrigo', 'rubens@kanban.local': 'Rubens',
    'kaiky@kanban.local': 'Kaiky', 'pedro@kanban.local': 'Pedro',
};