package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.*;

/**
 * Walks a business's own website and returns the readable text of each page.
 *
 * Deliberately conservative. A crawler pointed at someone's site is a robot making requests
 * they did not ask for, and every page it returns costs an embedding call, so it stays on one
 * host, obeys robots.txt, stops at a page limit, and pauses between requests. The limits are
 * the feature, not a shortcut.
 */
@Service
@Slf4j
public class WebCrawler {

    /** What a page must be worth reading to be indexed at all. */
    private static final int MIN_USEFUL_CHARACTERS = 120;

    /**
     * A ceiling per page. An archive or a news index runs to tens of thousands of words and
     * would produce more chunks than the entire rest of a small site, at a matching cost,
     * while answering nothing a customer asks.
     */
    private static final int MAX_PAGE_CHARACTERS = 20_000;

    private static final String USER_AGENT = "EkSamadhanAI/1.0 (support knowledge base crawler)";

    /** Nav, footers and cookie banners repeat on every page and drown the actual content. */
    private static final String BOILERPLATE = "nav, header, footer, script, style, noscript, "
            + "svg, form, aside, [role=navigation], [role=banner], [role=contentinfo], "
            + ".cookie, .cookies, #cookie, .menu, .navbar, .sidebar";

    private final int maxPages;
    private final int maxDepth;
    private final long politenessMs;

    public WebCrawler(@Value("${app.crawler.max-pages:25}") int maxPages,
                      @Value("${app.crawler.max-depth:2}") int maxDepth,
                      @Value("${app.crawler.delay-ms:400}") long politenessMs) {
        this.maxPages = maxPages;
        this.maxDepth = maxDepth;
        this.politenessMs = politenessMs;
    }

    /** One crawled page: what to call it, where it came from, and what it said. */
    public record Page(String url, String title, String text) {}

    /**
     * Crawls from {@code startUrl}, staying on its host.
     *
     * @throws IllegalArgumentException if the address is unusable, so the admin is told rather
     *         than left watching an empty list
     */
    public List<Page> crawl(String startUrl) {
        URI start = normalise(startUrl);
        String host = start.getHost();
        Set<String> disallowed = robotsDisallow(start);

        List<Page> pages = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        Deque<Map.Entry<URI, Integer>> queue = new ArrayDeque<>();
        queue.add(Map.entry(start, 0));
        seen.add(start.toString());   // already canonical, so "site.com" and "site.com/" agree

        while (!queue.isEmpty() && pages.size() < maxPages) {
            Map.Entry<URI, Integer> next = queue.poll();
            URI url = next.getKey();
            int depth = next.getValue();

            if (isDisallowed(url, disallowed)) {
                log.debug("robots.txt disallows {}", url);
                continue;
            }

            Document document;
            try {
                document = Jsoup.connect(url.toString())
                        .userAgent(USER_AGENT)
                        .timeout(15000)
                        .followRedirects(true)
                        .get();
            } catch (Exception e) {
                log.debug("Skipped {}: {}", url, e.getMessage());
                continue;
            }

            String text = readable(document);
            if (text.length() > MAX_PAGE_CHARACTERS) {
                log.debug("Truncated {} from {} characters", url, text.length());
                text = text.substring(0, MAX_PAGE_CHARACTERS);
            }
            if (text.length() >= MIN_USEFUL_CHARACTERS) {
                String title = document.title().isBlank() ? url.getPath() : document.title().strip();
                pages.add(new Page(url.toString(), title, text));
            }

            if (depth < maxDepth) {
                for (Element link : document.select("a[href]")) {
                    URI found = sameSite(link.absUrl("href"), host);
                    if (found == null || !seen.add(found.toString())) continue;
                    queue.add(Map.entry(found, depth + 1));
                }
            }

            // Someone else's server, being asked for pages it did not expect.
            try {
                Thread.sleep(politenessMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        log.info("Crawled {} usable pages from {}", pages.size(), host);
        return pages;
    }

    /** Body text with the furniture removed, and whitespace collapsed into paragraphs. */
    private String readable(Document document) {
        Document copy = document.clone();
        copy.select(BOILERPLATE).remove();

        Element main = copy.selectFirst("main, article, [role=main]");
        Element root = main != null ? main : copy.body();
        if (root == null) return "";

        // Headings become their own lines, which is what the chunker splits on.
        root.select("h1, h2, h3, h4").forEach(h -> h.before("\n\n").after("\n\n"));
        root.select("p, li, br, div, tr").forEach(e -> e.after("\n"));

        return root.wholeText()
                .replaceAll("[ \\t\\x0B\\f\\r]+", " ")
                .replaceAll(" *\n *", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .strip();
    }

    private URI normalise(String raw) {
        try {
            String candidate = raw.strip();
            if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
                candidate = "https://" + candidate;
            }
            URI uri = URI.create(candidate);
            if (uri.getHost() == null) throw new IllegalArgumentException("no host");
            return canonical(uri);
        } catch (Exception e) {
            throw new IllegalArgumentException("That does not look like a website address: " + raw);
        }
    }

    /**
     * Links on the same host only. A crawler that wanders off-site indexes other people's
     * content as though the business had written it.
     */
    private URI sameSite(String href, String host) {
        try {
            if (href == null || href.isBlank()) return null;
            URI uri = URI.create(href).normalize();
            if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) return null;
            if (!host.equalsIgnoreCase(uri.getHost())) return null;

            String path = uri.getPath() == null ? "/" : uri.getPath();
            if (path.matches("(?i).*\\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|mp3|css|js)$")) return null;

            // Fragments are the same page; query strings are usually filters and sort orders.
            return canonical(new URI(uri.getScheme(), uri.getHost(), path, null));
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * One spelling per page. Without this, "https://site.com" and "https://site.com/" are two
     * entries in the queue, and the same page is crawled and indexed twice.
     */
    private URI canonical(URI uri) {
        try {
            String path = uri.getPath() == null ? "" : uri.getPath();
            while (path.endsWith("/")) path = path.substring(0, path.length() - 1);
            return new URI(uri.getScheme(), uri.getHost(), path.isEmpty() ? "/" : path, null);
        } catch (Exception e) {
            return uri;
        }
    }

    /** The paths robots.txt asks every crawler to leave alone. */
    private Set<String> robotsDisallow(URI site) {
        Set<String> rules = new HashSet<>();
        try {
            String body = Jsoup.connect(site.getScheme() + "://" + site.getHost() + "/robots.txt")
                    .userAgent(USER_AGENT).timeout(8000).ignoreContentType(true).execute().body();

            boolean appliesToUs = false;
            for (String line : body.split("\n")) {
                String rule = line.split("#")[0].strip();
                if (rule.toLowerCase(Locale.ROOT).startsWith("user-agent:")) {
                    appliesToUs = rule.substring(11).strip().equals("*");
                } else if (appliesToUs && rule.toLowerCase(Locale.ROOT).startsWith("disallow:")) {
                    String path = rule.substring(9).strip();
                    if (!path.isEmpty()) rules.add(path);
                }
            }
        } catch (Exception e) {
            // No robots.txt means no restrictions, which is the common case for a small site.
            log.debug("No robots.txt for {}: {}", site.getHost(), e.getMessage());
        }
        return rules;
    }

    private boolean isDisallowed(URI url, Set<String> rules) {
        String path = url.getPath() == null || url.getPath().isEmpty() ? "/" : url.getPath();
        return rules.stream().anyMatch(path::startsWith);
    }
}
