package io.eksamadhan.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * One error shape for the whole API: {@code {"error": "..."}}, matching what the existing
 * controllers already return by hand.
 *
 * Without this, a thrown ResponseStatusException is forwarded to Spring's /error page,
 * whose body varies with the devtools profile — and the frontend has no reliable field to
 * show the user.
 */
@RestControllerAdvice
@Slf4j
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        String message = e.getReason() == null ? "Request failed" : e.getReason();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", message));
    }

    /**
     * A body that cannot be read — malformed JSON, or a value outside an enum such as a role
     * that does not exist. That is the caller's mistake, not a server failure: it used to fall
     * through to the 500 below, so a bad invite role looked like the server had crashed.
     */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleUnreadable(
            org.springframework.http.converter.HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "The request could not be read. Check the values sent."));
    }

    /**
     * A value in the address that is the wrong shape (a conversation id that is not a UUID, a
     * limit that is not a number) or a required one left out. Also the caller's mistake: these
     * used to fall through to the 500 below.
     */
    @ExceptionHandler({
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class,
            org.springframework.web.multipart.support.MissingServletRequestPartException.class})
    public ResponseEntity<Map<String, String>> handleBadParameter(Exception e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "The request could not be read. Check the values sent."));
    }

    /** A photo or voice note over the upload limit (spring.servlet.multipart). */
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(Exception e) {
        return ResponseEntity.status(413)
                .body(Map.of("error", "That file is too large to send. Choose a smaller one."));
    }

    /**
     * An address with no endpoint, or an endpoint called with the wrong method. Spring raises
     * these as exceptions too, so without this they fell through to the 500 below and an
     * unknown address looked like a server crash.
     */
    @ExceptionHandler({
            org.springframework.web.servlet.resource.NoResourceFoundException.class,
            org.springframework.web.HttpRequestMethodNotSupportedException.class})
    public ResponseEntity<Map<String, String>> handleNoEndpoint(Exception e) {
        boolean wrongMethod = e instanceof org.springframework.web.HttpRequestMethodNotSupportedException;
        return ResponseEntity.status(wrongMethod ? HttpStatus.METHOD_NOT_ALLOWED : HttpStatus.NOT_FOUND)
                .body(Map.of("error", wrongMethod ? "That action is not allowed here." : "Not found."));
    }

    /** Anything unplanned: logged in full, but described to the caller in one line. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Something went wrong. Please try again."));
    }
}
