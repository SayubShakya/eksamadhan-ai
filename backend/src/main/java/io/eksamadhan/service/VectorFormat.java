package io.eksamadhan.service;

/** pgvector's text representation, which is how vectors are bound into native queries. */
public final class VectorFormat {

    private VectorFormat() {}

    /** Renders {@code [0.1,0.2,…]}, the literal form pgvector casts with {@code ::vector}. */
    public static String toLiteral(float[] vector) {
        StringBuilder out = new StringBuilder(vector.length * 12 + 2).append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) out.append(',');
            out.append(vector[i]);
        }
        return out.append(']').toString();
    }
}
