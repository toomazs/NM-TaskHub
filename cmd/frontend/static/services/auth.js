import { supabaseClient } from '../config.js';

export async function signIn(email, password) {
    return await supabaseClient.auth.signInWithPassword({ email, password });
}

export async function signOut() {
    return await supabaseClient.auth.signOut();
}

export async function getSession() {
    return await supabaseClient.auth.getSession();
}
