package io.eksamadhan.service;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * Whether an address is on the public internet, for anything the server fetches because a user
 * typed a URL (the website crawl).
 *
 * Without it, "add knowledge from a website" was a way to make this server read its own
 * internals and hand them back: http://localhost:8080/..., the database, the office router, or a
 * cloud host's metadata service at 169.254.169.254, which gives out the machine's credentials.
 * Sign-up is open, so anyone could do it, and the fetched text could be read back as a knowledge
 * source. Every address the host resolves to must be public, and the check runs on every hop
 * of a redirect, since a public page can redirect to a private one.
 *
 * What remains: DNS can answer differently between this check and the fetch (rebinding). The
 * crawler re-checks each redirect, which covers the common case; closing the rest needs the
 * fetch to connect to the checked address itself.
 */
public final class PublicAddress {

    private PublicAddress() {}

    /** @throws IllegalArgumentException with a message fit to show the person */
    public static void require(URI uri) {
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            throw new IllegalArgumentException("Only http and https website addresses can be added.");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("That does not look like a website address.");
        }
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("That website could not be found: " + host);
        }
        for (InetAddress address : addresses) {
            if (!isPublic(address)) {
                throw new IllegalArgumentException("That address is not a public website, so it cannot be added.");
            }
        }
    }

    static boolean isPublic(InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress()
                || a.isSiteLocalAddress() || a.isMulticastAddress()) {
            return false;
        }
        byte[] b = a.getAddress();
        if (a instanceof Inet4Address) {
            int first = b[0] & 0xff, second = b[1] & 0xff;
            if (first == 0) return false;                                   // 0.0.0.0/8, "this network"
            if (first == 100 && second >= 64 && second <= 127) return false; // 100.64.0.0/10, carrier NAT
            if (first == 192 && second == 0 && (b[2] & 0xff) == 0) return false; // 192.0.0.0/24, protocol use
            if (first == 198 && (second == 18 || second == 19)) return false;    // 198.18.0.0/15, benchmarking
            if (first >= 240) return false;                                 // reserved and broadcast
            return true;
        }
        if (a instanceof Inet6Address) {
            if ((b[0] & 0xfe) == 0xfc) return false;                        // fc00::/7, unique local
            // An IPv4 address written as IPv6 (::ffff:10.0.0.1) is judged as the IPv4 it is.
            boolean mapped = true;
            for (int i = 0; i < 10; i++) if (b[i] != 0) { mapped = false; break; }
            if (mapped && (b[10] & 0xff) == 0xff && (b[11] & 0xff) == 0xff) {
                try {
                    return isPublic(InetAddress.getByAddress(new byte[] { b[12], b[13], b[14], b[15] }));
                } catch (UnknownHostException e) {
                    return false;
                }
            }
        }
        return true;
    }
}
