package io.eksamadhan.service;

import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Which conversations the AI is writing a reply in right now.
 *
 * The "ai-typing" live event is the fast way a dashboard hears it, but a stream can be held back
 * on the way: through the Cloudflare tunnel a phone uses, no event arrived at all. The thread list
 * a dashboard refreshes every 1.5 seconds carries the same fact from here, so "AI is typing"
 * shows on every device, at worst a moment late. In memory only: it lasts seconds, and a
 * restart ends every reply it describes.
 */
@Component
public class AiTypingState {

    private final Set<UUID> threads = ConcurrentHashMap.newKeySet();

    public void set(UUID threadId, boolean typing) {
        if (threadId == null) return;
        if (typing) threads.add(threadId);
        else threads.remove(threadId);
    }

    public boolean isTyping(UUID threadId) {
        return threadId != null && threads.contains(threadId);
    }
}
