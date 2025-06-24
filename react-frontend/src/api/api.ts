import { supabaseClient } from './supabaseClient';

export async function api(path: string, options: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const headers = new Headers(options.headers || {});

    if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    }

    const response = await fetch(`/api${path}`, { ...options, headers });

    if (response.status === 401) {
        await supabaseClient.auth.signOut();
        window.location.assign('/login');
        throw new Error('Sessão expirada.');
    }

    return response;
}