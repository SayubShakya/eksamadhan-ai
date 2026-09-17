package io.eksamadhan.model;

/** Where a knowledge source came from. */
public enum KnowledgeSourceType {
    TEXT,
    PDF,
    /** A picture, retrieved through its title, caption and an auto-written description. */
    IMAGE,
    /** One page crawled from the business's own website. */
    URL
}
