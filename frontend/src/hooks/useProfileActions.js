// Changes the signed-in person makes to themselves: their name and photo, and their status.
import { useCallback } from 'react';
import * as api from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

export default function useProfileActions({ setSession, setMyHours }) {
    /**
     * Returns an error message instead of throwing, so the panel can show it. Silently
     * swallowing a failed write makes a lost photo look like a UI bug.
     */
    const saveProfile = useCallback(async (next) => {
        try {
            const updated = await api.updateMe({
                firstName: next.firstName,
                lastName: next.lastName,
                avatar: next.avatar,
            });
            api.setToken(updated.token);
            setSession(updated);
            toast.success(t('Profile saved'), { body: t('Your team sees your new name and photo.') });
            return null;
        } catch (err) {
            return api.errorMessage(err, t('Your profile could not be saved.'));
        }
    }, []);

    const changeAvailability = useCallback(async (next) => {
        try {
            const result = await api.setAvailability(next);
            if (result?.hours) setMyHours(result.hours);
            setSession(s => (s ? { ...s, user: { ...s.user, availability: result.availability } } : s));
            toast.success(result.availability === 'BUSY' ? t('You are now Busy') : t('You are now Available'), { body: result.availability === 'BUSY' ? t('You keep your conversations; new ones go to others.') : t('New conversations can come to you.') });
        } catch (err) {
            toast.error(t('Status not changed'), { body: api.errorMessage(err, t('Your status could not be changed.')) });
        }
    }, []);

    return { saveProfile, changeAvailability };
}
