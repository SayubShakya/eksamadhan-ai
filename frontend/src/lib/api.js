import axios from 'axios';

// Free Pinggy tunnels serve a browser interstitial without this header.
axios.defaults.headers.common['X-Pinggy-No-Screen'] = 'true';

const TOKEN_KEY = 'session';

export function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode: the session lasts until the tab closes */ }
}

export const clearToken = () => setToken(null);

// The workspace is never named in a URL any more — it comes from this token, so an agent
// can only ever reach their own inbox.
axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// An expired or revoked token should land on the sign-in screen rather than leaving the
// dashboard polling into a wall of 401s.
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401 && getToken()) {
            clearToken();
            window.dispatchEvent(new Event('auth:expired'));
        }
        return Promise.reject(error);
    },
);

/** The message the server sent, or a readable fallback. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
    if (!err?.response) return 'Could not reach the server. Check that the backend is running.';
    return err.response.data?.error || fallback;
}

// ── Accounts ────────────────────────────────────────────────────────────────
export const signUp = (payload) => axios.post('/api/auth/signup', payload).then(r => r.data);
export const logIn = (payload) => axios.post('/api/auth/login', payload).then(r => r.data);
export const getMe = () => axios.get('/api/me').then(r => r.data);
export const updateMe = (payload) => axios.put('/api/me', payload).then(r => r.data);

// ── Invitations (public: the recipient has no account yet) ──────────────────
// Sign in with Google: the Firebase ID token, which the backend checks against Google's keys.
export const logInWithGoogle = (idToken) =>
    axios.post('/api/auth/google', { idToken }).then(r => r.data);
export const signUpWithGoogle = (idToken, organizationName) =>
    axios.post('/api/auth/signup/google', { idToken, organizationName }).then(r => r.data);
export const acceptInviteWithGoogle = (token, idToken) =>
    axios.post(`/api/auth/invitations/${token}/accept/google`, { idToken }).then(r => r.data);
export const previewInvite = (token) => axios.get(`/api/auth/invitations/${token}`).then(r => r.data);
export const acceptInvite = (token, payload) =>
    axios.post(`/api/auth/invitations/${token}/accept`, payload).then(r => r.data);

// ── Team ────────────────────────────────────────────────────────────────────
export const getTeam = () => axios.get('/api/team').then(r => r.data);
export const createInvite = (payload) => axios.post('/api/team/invites', payload).then(r => r.data);
export const revokeInvite = (id) => axios.delete(`/api/team/invites/${id}`);
export const removeMember = (id) => axios.delete(`/api/team/members/${id}`);

// ── Knowledge base ──────────────────────────────────────────────────────────
export const getKnowledge = () => axios.get('/api/knowledge').then(r => r.data);
export const addKnowledgeText = (payload) => axios.post('/api/knowledge/text', payload).then(r => r.data);
export const getKnowledgeContent = (id) =>
    axios.get(`/api/knowledge/${id}/content`).then(r => r.data);
export const reindexKnowledge = (id) =>
    axios.post(`/api/knowledge/${id}/reindex`).then(r => r.data);
export const deleteKnowledge = (id) => axios.delete(`/api/knowledge/${id}`);
export const searchKnowledge = (q, topK) =>
    axios.get('/api/knowledge/search', { params: { q, topK } }).then(r => r.data);

export const crawlWebsite = (url) =>
    axios.post('/api/knowledge/website', { url }).then(r => r.data);

/**
 * Upload progress for a determinate bar: a fraction from 0 to 1, or null when the browser
 * cannot tell the total size.
 */
const progress = (onProgress) => (onProgress
    ? { onUploadProgress: (e) => onProgress(e.total ? e.loaded / e.total : null) }
    : {});

export function uploadKnowledgeImage({ file, title, caption, onProgress }) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('title', title);
    if (caption) form.append('caption', caption);
    return axios.post('/api/knowledge/image', form, progress(onProgress)).then(r => r.data);
}

export function uploadKnowledge({ file, title, onProgress }) {
    const form = new FormData();
    form.append('file', file, file.name);
    if (title) form.append('title', title);
    return axios.post('/api/knowledge/upload', form, progress(onProgress)).then(r => r.data);
}

// ── Analytics ───────────────────────────────────────────────────────────────
export const getAnalytics = (days = 30) =>
    axios.get('/api/analytics', { params: { days } }).then(r => r.data);

// ── Inbox ───────────────────────────────────────────────────────────────────
export const getStatus = () => axios.get('/api/auth/status').then(r => r.data);
export const getMessages = () => axios.get('/api/messages').then(r => r.data);
export const getThreads = () => axios.get('/api/threads').then(r => r.data);

export const setThreadState = (threadId, action, body) =>
    axios.post(`/api/threads/${threadId}/${action}`, body || {});
export const summariseThread = (threadId) =>
    axios.post(`/api/threads/${threadId}/summarise`).then(r => r.data);
export const assignThread = (threadId, userId) =>
    axios.post(`/api/threads/${threadId}/assign`, { userId }).then(r => r.data);
export const syncMessages = () => axios.post('/api/messages/sync');
export const sendReply = (payload) => axios.post('/api/messages/reply', payload);
export const reactToMessage = (payload) => axios.post('/api/messages/react', payload);

export function sendImage({ file, recipientId, pageId, onProgress }) {
    const form = new FormData();
    form.append('file', file, file.name || 'photo.jpg');
    form.append('recipientId', recipientId);
    if (pageId) form.append('pageId', pageId);
    return axios.post('/api/messages/image', form, progress(onProgress));
}

export function sendVoice({ blob, recipientId, pageId, onProgress }) {
    const form = new FormData();
    form.append('file', blob, 'voice.webm');
    form.append('recipientId', recipientId);
    if (pageId) form.append('pageId', pageId);
    return axios.post('/api/messages/voice', form, progress(onProgress));
}

// ── Channels ────────────────────────────────────────────────────────────────
/**
 * A browser navigation cannot carry the bearer token, so the consent URL is fetched first
 * and then navigated to. The state inside it is signed by the backend.
 */
export const connectUrl = (platform) =>
    axios.get('/api/auth/connect-url', { params: { platform } }).then(r => r.data.url);

/** Removes every connected page and the stored history. Not the same as signing out. */
export const disconnectChannels = () => axios.post('/api/auth/disconnect');

// ── Notifications ───────────────────────────────────────────────────────────
export const getPushKey = () => axios.get('/api/push/key').then(r => r.data);
export const subscribeToPush = (subscription) =>
    axios.post('/api/push/subscribe', subscription).then(r => r.data);
export const unsubscribeFromPush = (subscription) =>
    axios.post('/api/push/unsubscribe', subscription).then(r => r.data);
export const sendTestPush = () => axios.post('/api/push/test').then(r => r.data);
export const getNotifications = () => axios.get('/api/notifications').then(r => r.data);
export const markNotificationsRead = () => axios.post('/api/notifications/read').then(r => r.data);

// ── System admin ────────────────────────────────────────────────────────────
// Across every workspace; the server refuses anyone who is not a system admin.
export const getSystemMessages = (q) =>
    axios.get('/api/system/messages', { params: { limit: 100, ...(q ? { q } : {}) } }).then(r => r.data);
export const getMessageTrace = (id) =>
    axios.get(`/api/system/messages/${id}/trace`).then(r => r.data);
