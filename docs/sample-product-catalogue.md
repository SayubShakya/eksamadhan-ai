# Sample knowledge base — Acme product catalogue

A second demo source for the Knowledge screen, covering **products** rather than policies.
Use it alongside [`sample-knowledge-base.md`](sample-knowledge-base.md), which covers
shipping, returns and payments.

Having both loaded is the more honest demonstration: with one source, every query has only
one place to land. With two, retrieval has to choose — and "is the charger included?" has to
find the product entry rather than the shipping policy, which is the thing worth showing.

Same rule as the other file: the short heading lines force passage boundaries, so each
product stays in its own chunk instead of bleeding into the next.

---

## Paste this

**Title**

```
Product catalogue
```

**Text**

```
Acme Buds Air

Wireless earbuds, Rs 4200. Bluetooth 5.3, up to 6 hours of playback on a charge and 24 hours with the case. Active noise cancellation. Sweat resistant, rated IPX4, so they are fine for the gym but not for swimming. Available in black and white. In stock.

Acme Buds Pro

Wireless earbuds, Rs 7900. Everything the Buds Air has, plus a better microphone for calls, wireless charging of the case, and up to 8 hours of playback. Rated IPX5. Available in black only. In stock.

Choosing between the two earbuds

Buy the Buds Air if you mainly listen to music and want to spend less. Buy the Buds Pro if you take a lot of calls, want to charge the case wirelessly, or need the longer battery. The sound quality is the same on both.

Acme PowerCell 20000

Power bank, Rs 3500. 20000 mAh, enough to charge most phones four times. Two USB-A ports and one USB-C port, 22.5W fast charging. Takes about five hours to fully recharge itself. Weighs 420 grams. In stock.

Acme PowerCell 10000

Power bank, Rs 2200. 10000 mAh, about two full phone charges. One USB-A and one USB-C port, 18W. Weighs 220 grams, so it fits a pocket. Currently out of stock, expected back in two weeks.

Acme Watch Lite

Smart watch, Rs 6500. 1.8 inch display, heart rate and sleep tracking, step counting, and up to 10 days of battery. Works with Android 8 and above and iOS 13 and above. Not suitable for swimming. Available in black and dark green. In stock.

Acme Sound Mini

Bluetooth speaker, Rs 5400. 10W output, 12 hours of playback, IPX6 so it survives rain and splashes. Pairs two speakers together for stereo. Available in grey. In stock.

Acme Charge 65

USB-C charger, Rs 2800. 65W, charges a laptop or a phone. Two USB-C ports and one USB-A. Folding pins. Cable is not included.

What comes in the box

Earbuds ship with the charging case, a short USB-C cable and three sizes of ear tip. Power banks ship with a USB-C cable. The watch ships with its own magnetic charging cable. The Charge 65 ships with no cable at all.

Colours and availability

Black is stocked in every product. White is only available for the Buds Air, dark green only for the Watch Lite, and grey only for the Sound Mini. Anything marked out of stock can be reserved by messaging us, and we will hold it for 48 hours once it arrives.
```

That produces ten passages, one per heading.

---

## Test queries

Measured on this exact text with `openai/text-embedding-3-small`, with **both** this catalogue
and the shipping source loaded — so every query had to choose between two documents and
twenty passages.

| Query | Top passage | Score | Runner-up | Gap |
| :--- | :--- | ---: | ---: | ---: |
| `which earbuds should I get for calls` | Choosing between the two earbuds | 0.635 | 0.514 | 0.121 |
| `is the Watch Lite waterproof` | Acme Watch Lite | 0.567 | — | — |
| `when will the small power bank be back` | Acme PowerCell 10000 | 0.516 | 0.475 | 0.041 |
| `what is the warranty on earbuds` | Warranty *(shipping source)* | 0.501 | 0.475 | 0.026 |
| `can I pay for the Buds Pro in instalments` | Payment methods *(shipping)* | 0.480 | — | — |
| `is a cable included with the charger` | Acme Charge 65 | 0.462 | 0.437 | 0.025 |
| `how many times will it charge my phone` | Acme PowerCell 20000 | 0.428 | 0.366 | 0.062 |
| `can I swim with the watch` | Acme Watch Lite | 0.418 | 0.265 | 0.153 |
| `do you have anything in green` | Colours and availability | 0.345 | 0.193 | 0.152 |
| `who is the prime minister of Nepal` | *(nothing relevant)* | 0.331 | 0.320 | 0.011 |

### The finding that matters most

**Off-topic questions score much higher against a larger knowledge base.** In
`sample-knowledge-base.md`, with one small source, `who won the football last night?` scored
**0.088**. Here, against twenty passages, `who is the prime minister of Nepal` scores
**0.331** — comfortably above the `app.ai.min-similarity` threshold of 0.25.

So the retrieval gate does **not** stop it. More passages mean more chances for something to
partially match, and the absolute score drifts upward as a knowledge base grows. A threshold
tuned on a small corpus quietly stops working as content is added, which is exactly the kind
of regression nobody notices until a customer sees it.

What holds the line is the model's own verdict. Checked end to end against the real system
prompt:

| Query | Retrieval | Model | Outcome |
| :--- | ---: | :--- | :--- |
| `is the Watch Lite waterproof` | 0.567 | answered | "not suitable for swimming, so it's not waterproof" |
| `can I pay for the Buds Pro in instalments` | 0.480 | declined | handed to a human |
| `who is the prime minister of Nepal` | 0.331 | declined | handed to a human |
| `do you sell laptops` | 0.314 | declined | handed to a human |

Nothing was invented in any case. But note the second and fourth rows: those are *business*
questions the knowledge base simply does not cover — instalments and laptops — and they scored
**higher** than a question about Nepali politics. Retrieval score alone cannot tell "relevant
but unanswered" from "irrelevant". Only reading the passages can, which is why the model is
asked whether they actually answer the question rather than being trusted to notice.

One caveat measured rather than assumed: the prime-minister query is borderline. Run twice at
`temperature: 0.2` it declined once and once replied "I can't help with that" without escalating.
Both are acceptable — neither invents — but it is not deterministic at that score.

### The gap is the better signal

Look at the Gap column. A confident match leads by **0.12–0.15**; an ambiguous one by
**0.02–0.04**; the off-topic query by **0.011**. That separation is far cleaner than the raw
score, and unlike the raw score it does not drift as the knowledge base grows.

`is a cable included with the charger` sits at 0.462 against 0.437 — a 0.025 gap, because
"What comes in the box" is an almost equally good answer. Both are retrieved, both go to the
model, and the answer is right either way. That is the argument for top-k rather than
top-one, and a better illustration than any of the clean matches.

### Cross-document retrieval

`what is the warranty on earbuds` returns **Warranty** — from the *other* source. The
catalogue never mentions warranty, so the right answer genuinely lives in the shipping
document. This is the clearest demonstration that retrieval searches the whole knowledge base
rather than one file, and it is the query to run in a demo once both sources are loaded.

`can I swim with the watch` is answered by a negative: the passage says "not suitable for
swimming". Nothing in the query shares a word with that sentence beyond "swim", and a keyword
search returns the Sound Mini, which mentions water resistance and is the wrong product.

---

## Adding your own products

Three things make a product entry retrieve well:

1. **Start with the product name on its own line.** It becomes the heading, which forces a
   passage boundary and keeps one product out of the next one's chunk.
2. **Put the price and the decisive facts in the first sentence.** Retrieval scores the whole
   passage, but a model answering from it reads top-down.
3. **State the negatives explicitly.** "Not suitable for swimming" and "cable is not included"
   are what customers actually ask about, and an absent fact cannot be retrieved. A catalogue
   that only lists what a product *does* forces every limitation to a human.
