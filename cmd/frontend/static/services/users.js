import { api } from '../api.js';

export async function getUsers() {
    return await api('/users');
}

export async function uploadAvatar(formData) {
    return await api('/user/avatar', {
        method: 'POST',
        body: formData
    });
}