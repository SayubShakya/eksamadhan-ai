package io.eksamadhan.service;

import io.eksamadhan.model.KnowledgeSourceType;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Pulls plain text out of an uploaded file so it can be chunked and embedded. */
@Service
public class DocumentTextExtractor {

    public KnowledgeSourceType typeOf(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name != null && name.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            return KnowledgeSourceType.PDF;
        }
        return KnowledgeSourceType.TEXT;
    }

    public String extract(MultipartFile file) {
        try {
            if (typeOf(file) == KnowledgeSourceType.PDF) {
                // Loader.loadPDF is the PDFBox 3 entry point; PDDocument.load was 2.x.
                try (PDDocument document = Loader.loadPDF(file.getBytes())) {
                    if (document.isEncrypted()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "That PDF is password-protected, so its text cannot be read.");
                    }
                    return new PDFTextStripper().getText(document);
                }
            }
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That file could not be read: " + e.getMessage());
        }
    }
}
