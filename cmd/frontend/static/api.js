// /static/api.js - CORRIGIDO

import { supabaseClient } from './config.js';

// func timeout
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// func wrapper para API
export async function api(path, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const headers = { ...options.headers };

            if (!(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(`/api${path}`, { ...options, headers });

            if (response.status === 401) {
                await supabaseClient.auth.signOut();
                location.reload();
                return null;
            }

            if (response.status >= 500 && i < retries - 1) {
                await sleep(1000 * (i + 1));
                continue;
            }

            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await sleep(500 * (i + 1));
        }
    }
}

// --- FUNÇÃO DEBOUNCE CORRIGIDA ---
// Esta nova versão inclui o método .cancel() que o seu código precisa.
export const debounce = (func, wait) => {
    let timeout;

    const debounced = function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };

    // Anexa o método cancel à função retornada
    debounced.cancel = () => {
        clearTimeout(timeout);
    };

    return debounced;
};