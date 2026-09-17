package io.eksamadhan.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits a document into passages small enough to embed and retrieve usefully.
 *
 * Splitting happens at paragraph boundaries where possible, because a paragraph is usually
 * one idea and a chunk that spans two answers neither well. Consecutive chunks overlap so a
 * sentence sitting on a boundary is not lost to both of them.
 *
 * A heading also forces a break. Business knowledge is overwhelmingly written as short
 * sections — "Returns", "Payment methods" — and packing several of them into one chunk
 * purely because they fit under the size limit is what makes retrieval useless: every query
 * then matches the same undifferentiated blob. The heading stays with the text beneath it.
 */
@Service
public class TextChunker {

    private final int chunkSize;
    private final int overlap;

    public TextChunker(@Value("${app.ai.chunk-size:1200}") int chunkSize,
                       @Value("${app.ai.chunk-overlap:200}") int overlap,
                       @Value("${app.ai.min-chunk-size:250}") int minChunkSize) {
        this.chunkSize = chunkSize;
        this.minChunkSize = Math.min(minChunkSize, chunkSize);
        // An overlap at or above the chunk size would never advance.
        this.overlap = Math.min(overlap, Math.max(0, chunkSize / 2));
    }

    /**
     * Below this a passage is too small to retrieve well: it carries a heading and almost no
     * content, so it matches a query on the heading alone and then answers nothing.
     */
    private final int minChunkSize;

    public List<String> chunk(String text) {
        List<String> chunks = new ArrayList<>();
        if (text == null) return chunks;

        String normalised = text.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (normalised.isEmpty()) return chunks;

        StringBuilder current = new StringBuilder();
        for (String paragraph : normalised.split("\n\\s*\n")) {
            String trimmed = paragraph.strip();
            if (trimmed.isEmpty()) continue;

            // A heading starts a new section, so close the current chunk first — but keep
            // the heading itself with the text that follows it.
            if (isHeading(trimmed) && current.length() > 0) {
                flush(chunks, current);
            }

            // A single paragraph longer than a chunk has to be cut mid-paragraph.
            if (trimmed.length() > chunkSize) {
                flush(chunks, current);
                chunks.addAll(splitLongParagraph(trimmed));
                continue;
            }

            if (current.length() + trimmed.length() + 2 > chunkSize) {
                flush(chunks, current);
                String carry = tail(chunks);
                if (!carry.isEmpty()) current.append(carry).append("\n\n");
            }
            if (current.length() > 0) current.append("\n\n");
            current.append(trimmed);
        }
        flush(chunks, current);
        return coalesce(chunks);
    }

    /**
     * Merges runs of tiny passages back together.
     *
     * The heading rule is right for a document written in sections and wrong for a page that
     * is mostly a list: a news archive of short dated links produced 137 passages averaging
     * 146 characters, each matching on its heading and answering nothing. Merging restores
     * useful passages without losing the boundaries that matter in prose.
     */
    private List<String> coalesce(List<String> chunks) {
        List<String> merged = new ArrayList<>();
        StringBuilder pending = new StringBuilder();

        for (String chunk : chunks) {
            if (pending.length() > 0 && pending.length() + chunk.length() + 2 > chunkSize) {
                merged.add(pending.toString());
                pending.setLength(0);
            }
            if (pending.length() > 0) pending.append("\n\n");
            pending.append(chunk);

            // Big enough to stand on its own; anything smaller keeps collecting.
            if (pending.length() >= minChunkSize) {
                merged.add(pending.toString());
                pending.setLength(0);
            }
        }
        if (pending.length() > 0) merged.add(pending.toString());
        return merged;
    }

    /**
     * A short line with no sentence-ending punctuation, e.g. "Payment methods". Deliberately
     * conservative: a false positive costs one extra chunk boundary, while a false negative
     * merges two topics into a passage that answers neither.
     */
    private boolean isHeading(String paragraph) {
        if (paragraph.length() > 60 || paragraph.contains("\n")) return false;
        char last = paragraph.charAt(paragraph.length() - 1);
        return last != '.' && last != '!' && last != '?' && last != ',' && last != ';' && last != ':';
    }

    private List<String> splitLongParagraph(String paragraph) {
        List<String> parts = new ArrayList<>();
        int step = Math.max(1, chunkSize - overlap);
        for (int start = 0; start < paragraph.length(); start += step) {
            int end = Math.min(paragraph.length(), start + chunkSize);
            // Prefer to break after a sentence rather than mid-word.
            if (end < paragraph.length()) {
                int boundary = paragraph.lastIndexOf(". ", end);
                if (boundary > start + chunkSize / 2) end = boundary + 1;
            }
            parts.add(paragraph.substring(start, end).strip());
            if (end >= paragraph.length()) break;
        }
        return parts;
    }

    private void flush(List<String> chunks, StringBuilder current) {
        if (current.length() > 0) {
            chunks.add(current.toString().strip());
            current.setLength(0);
        }
    }

    /** The trailing slice of the previous chunk, carried into the next one as context. */
    private String tail(List<String> chunks) {
        if (overlap <= 0 || chunks.isEmpty()) return "";
        String previous = chunks.get(chunks.size() - 1);
        if (previous.length() <= overlap) return previous;
        String slice = previous.substring(previous.length() - overlap);
        int space = slice.indexOf(' ');
        return space > 0 ? slice.substring(space + 1) : slice;
    }
}
