package io.eksamadhan.model;

/** Where a knowledge source came from. URL scraping is future work. */
public enum KnowledgeSourceType {
    TEXT,
    PDF,
    /** A picture, retrieved through its title, caption and an auto-written description. */
    IMAGE
}
