import { supabaseClient } from '../api/supabaseClient';

export async function signIn(email: string, password: string) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) throw error;
    
    return data;
}

export async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

export async function getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data;
}