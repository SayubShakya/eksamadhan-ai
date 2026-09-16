import axios from 'axios';

// Free Pinggy tunnels serve a browser interstitial without this header.
axios.defaults.headers.common['X-Pinggy-No-Screen'] = 'true';

export const getStatus = (tenantId) => axios.get(`/api/auth/status/${tenantId}`).then(r => r.data);
export const getMessages = (tenantId) => axios.get(`/api/messages/${tenantId}`).then(r => r.data);
export const syncMessages = (tenantId) => axios.post(`/api/messages/sync/${tenantId}`);
export const sendReply = (tenantId, payload) => axios.post(`/api/messages/reply/${tenantId}`, payload);
export const logout = (tenantId) => axios.post(`/api/auth/logout/${tenantId}`);

export const reactToMessage = (tenantId, payload) =>
    axios.post(`/api/messages/react/${tenantId}`, payload);

export function sendImage(tenantId, { file, recipientId, pageId }) {
    const form = new FormData();
    form.append('file', file, file.name || 'photo.jpg');
    form.append('recipientId', recipientId);
    if (pageId) form.append('pageId', pageId);
    return axios.post(`/api/messages/image/${tenantId}`, form);
}

export function sendVoice(tenantId, { blob, recipientId, pageId }) {
    const form = new FormData();
    form.append('file', blob, 'voice.webm');
    form.append('recipientId', recipientId);
    if (pageId) form.append('pageId', pageId);
    return axios.post(`/api/messages/voice/${tenantId}`, form);
}
export const connectUrl = (platform, tenantId) => `/api/auth/${platform}?tenantId=${tenantId}`;
