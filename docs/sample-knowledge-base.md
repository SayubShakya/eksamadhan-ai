# Sample knowledge base — Acme Support

Demo content for the Knowledge screen (`/dashboard/knowledge`), used to exercise and
demonstrate semantic retrieval. Paste the block below into **Title** and **Text**, then run
the queries at the end.

The short heading lines are doing real work: the chunker starts a new passage at each one,
which is what keeps a retrieved passage on a single topic. A wall of text with no headings
indexes as one undifferentiated blob and every query matches it equally.

---

## Paste this

**Title**

```
Shipping, returns and payments
```

**Text**

```
Shipping

Acme dispatches every order within two working days of payment. Standard delivery inside the Kathmandu valley takes one to two days. Pokhara, Chitwan and Butwal take two to three days. Everywhere else in Nepal takes three to five days.

Delivery charges

Delivery costs Rs 150 inside the Kathmandu valley and Rs 250 elsewhere in Nepal. Delivery is free on any order over Rs 5000. We do not ship outside Nepal.

Tracking your order

You receive a tracking code by SMS as soon as your parcel leaves our warehouse. If you have not received a code within three working days of ordering, message us here with your order number and we will check it.

Returns

You can return any unused item within 30 days of delivery for a full refund. The item must be in its original packaging with all tags attached. Sale items and earphones cannot be returned for hygiene reasons.

Refunds

Once we receive and inspect a returned item, your refund is issued within seven working days. Refunds go back to the original payment method. Cash on delivery orders are refunded by eSewa or bank transfer.

Damaged or wrong items

If your item arrives damaged, or we sent the wrong thing, message us within 48 hours with a photo. We arrange a free pickup and send a replacement at no cost to you. This is separate from the normal 30 day return window.

Warranty

All electronics carry a one year manufacturer warranty covering manufacturing faults. The warranty does not cover accidental damage, water damage, or damage from using the wrong charger. Bring the item and your invoice to our Naxal office for a warranty claim.

Payment methods

We accept eSewa, Khalti, IME Pay, Visa and Mastercard, and cash on delivery. Cash on delivery is available inside the Kathmandu valley only and adds a Rs 100 handling fee.

Order changes and cancellation

You can change or cancel an order free of charge until it is dispatched. After dispatch, you will need to refuse the delivery or use the normal returns process.

Contact and opening hours

Our support team replies from 10am to 6pm, Sunday to Friday. We are closed on Saturdays and public holidays. You can also call 01-5555555 during those hours.
```

That produces roughly ten passages, one per section.

---

## Test queries

Paste these into **Test what the AI would find**. Each is worded to share almost no words
with the source — which is the point. Keyword search would find nothing; semantic search
finds the right passage because it matches on meaning.

| Query | Top passage | Score | Runner-up |
| :--- | :--- | ---: | ---: |
| `when will my parcel get to Pokhara?` | Shipping | 0.578 | 0.400 |
| `how long do I have to send something back?` | Damaged or wrong items | 0.484 | 0.437 |
| `can I pay when it arrives?` | Payment methods | 0.456 | 0.417 |
| `are you open on Saturday?` | Contact and opening hours | 0.421 | 0.201 |
| `my phone got wet, is that covered?` | Warranty | 0.377 | 0.277 |
| `it turned up broken` | Damaged or wrong items | 0.312 | 0.240 |
| `who won the football last night?` | *(none relevant)* | 0.088 | 0.064 |

These are measured, not predicted — run on this exact text on 2026-09-17 with
`openai/text-embedding-3-small`. Your numbers should land within a few thousandths.

Note what each query is doing. `my phone got wet` never uses the word "water"; `can I pay
when it arrives?` never says "cash on delivery"; `are you open on Saturday?` is answered by a
*negative* ("closed on Saturdays"). A keyword search returns nothing for any of them. That
contrast is the argument for semantic retrieval, and it is worth making explicitly in the
report.

### One result that is not what you would guess

`how long do I have to send something back?` retrieves **Damaged or wrong items** (0.484)
ahead of **Returns** (0.437), even though Returns is the section that actually contains "30
days". That is because the damaged-items section also talks about time limits ("within 48
hours") *and* about returning things, so it reads as a closer match to a question combining
both.

This is worth showing rather than hiding. Two things follow from it:

- The default `top-k` is 5, so **both** passages are retrieved and both would be given to the
  model. The final answer is still correct — which is precisely why retrieval hands over
  several passages instead of betting everything on the top one.
- It is a concrete example of why a single similarity score is a weak confidence signal on
  its own. The gap between first and second place, 0.484 against 0.437, is narrow; on a
  clean question like the Pokhara one it is 0.578 against 0.400. That gap is a better
  input to the confidence gate than the top score alone.

### The off-topic query matters most

`who won the football last night?` tops out at **0.088** — far below anything on-topic — and
the screen shows the "every match here is weak" warning. That is the evidence that the system
knows when it does **not** know: the hallucination-avoidance promise made in the contextual
report, where the AI is required to say "I do not know" rather than invent an answer. It is
also what the confidence gate will threshold on.

Screenshot a strong match and this weak one side by side. The pair demonstrates retrieval
quality far better than either alone.

### Reading the scores

From the measurements above:

- a clean, well-separated match: **0.42 – 0.58**
- a correct match on a topic that overlaps another section: **0.31 – 0.48**
- a plausible but wrong passage: **0.20 – 0.28**
- genuinely off-topic: **below 0.10**

A threshold somewhere around **0.25 – 0.30** separates "answer from this" from "say I don't
know". Settle the exact value when the confidence gate is built, with more than seven queries
behind it.

Two caveats when reading results:

- Scores are only comparable within one embedding model. Changing `app.ai.embedding-model`
  invalidates every stored vector and requires re-indexing, which is why the model name is
  recorded on every chunk.
- If a section consistently loses to a neighbour it should beat, the fix is usually to make
  the two sections more distinct — not to change the model or the threshold.

---

## A second source, for testing multi-source retrieval

Add this separately to confirm that search ranks across sources rather than favouring
whichever was added first.

**Title**

```
Product care
```

**Text**

```
Cleaning your device

Wipe screens with a dry microfibre cloth. Do not use alcohol, glass cleaner or household
detergent, as these strip the oleophobic coating.

Battery life

Charge between 20% and 80% where you can. Leaving a device at 100% on the charger overnight
every night shortens the battery's useful life.

Storage

If you are storing a device for more than a month, leave it at about half charge and keep it
somewhere dry and out of direct sunlight.
```

Then ask `how should I clean the screen?` — it should retrieve **Cleaning your device** from
this source, ahead of anything in the first one.
