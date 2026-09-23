# The Jev firewall

A decision model in front of the reply model. For every customer message, one TypeSafe
**Jev** judgment decides — before anything is generated — whether generating is needed at
all, and reads the customer's sentiment in the same round trip.

Jev is a *decision* model, not a generative one: it returns typed answers (a choice, a
score, a yes/no probability), never prose. That makes it the right tool for the judgments
this pipeline was paying a generative model to make.

## What it decides

Four questions, in two calls made side by side so the customer waits for one round trip:

| Question | Type | Seen with |
| :--- | :--- | :--- |
| What is the customer doing? greeting · thanks/ack · business question · complaint · wants a human · off-topic · abusive | Choice | the business |
| How do they feel? angry → negative → neutral → positive | Score | the business |
| Are they asking for a person? | Yes/no | the message alone |
| Are they trying to change the AI's instructions? | Yes/no | the message alone |

The last two see only the message on purpose. Neither has anything to do with the business,
and measured, the business description blurred both — as TypeSafe's own notes warn
unrelated state does.

## The one rule: act only when sure

| Judgment | Threshold | Action |
| :--- | :--- | :--- |
| injection attempt | ≥ 0.70 | hand to a person; the reply model never sees it |
| asking for a person | ≥ 0.65 | hand to a person |
| greeting | confidence ≥ 0.90 | a short greeting, no model call |
| thanks / acknowledgement | confidence ≥ 0.90 | a short "you're welcome", no model call |
| abuse with no request | confidence ≥ 0.90 | counts towards the off-topic limit |
| **anything else** | — | **the existing pipeline answers, unchanged** |

A confident *off-topic* is deliberately **not** acted on. The existing pipeline already judges
relatedness against the real knowledge base, and wrongly closing a real customer's
conversation is the one mistake worth never making.

The firewall also stands down when other messages are still waiting for an answer: "hello"
after an unanswered "delivery cost?" is not a greeting to reply to.

Any failure to reach Jev — timeout, error, missing key — falls back to the existing pipeline.

## Measured on this project's own messages

Every distinct customer message in the database (77, English and romanized Nepali, including
profanity and one-word questions), plus synthetic and **held-out** phrasings for the two
yes/no questions.

| Measure | Result |
| :--- | :--- |
| Sentiment agreement with the current generative model | **75 / 77 (97%)** |
| Intent, stable across business descriptions | 75 / 77 |
| Asking for a person — genuine requests vs everything else | ≥ 0.75 vs ≤ 0.55 |
| Injection — attempts vs everything else | ≥ 0.92 vs ≤ 0.43 |
| End-to-end check through the Java code path | 11 / 11 as expected |
| Latency per triage (two calls in parallel, from Nepal) | ~0.4–0.8 s; 2.1 s cold |
| Cost | about $0.00004 per message |

### What had to change to get there

- **The "asking for a person" question needed examples.** The plain wording *overlapped*: an
  insult ("lado muji", 0.74) outscored a genuine request (0.68), and "do you know Aayush?"
  read as asking for a person. With explicit yes/no criteria, including romanized Nepali, the
  gap opened to +0.20 — and held for phrasings the examples never mentioned.
- **The intent choice cannot decide a request for a person.** It put "Aayush lai chinchau?"
  under *wants_human* at 0.85. The yes/no question decides instead.
- **Jev is not deterministic.** Identical calls vary by about ±0.03, so every threshold sits in
  the middle of its gap, not at its edge.

### Known weaknesses

- **Romanized-Nepali profanity.** "lado muji" is read as neutral. With the firewall on, that
  message's sentiment would be wrong where the generative model got it right. Everything else
  about it is safe: it is below every action threshold, so the pipeline answers as usual.
- **It leaves the machine.** Jev is hosted only. Customer message text goes to TypeSafe, which
  commits not to train on it; zero data retention is offered to enterprise customers only.
  Embeddings already go to OpenRouter, so this is a second processor, not the first.

## Modes

`TRIAGE_MODE` in `backend/.env`:

- `shadow` (default) — judges every message **after** it has been answered and records what the
  firewall *would* have done. Behaviour does not change and no reply is slowed.
- `on` — acts, before the reply model. Sentiment comes from Jev too, taking one generative call
  per message off the local model's queue; the generative model reads it only if Jev is down.
- `off` — nothing is called. Also the effective mode whenever `TYPESAFE_API_KEY` is empty.

## Reading the shadow results

Each judged message is a row in `message_triage`. What the firewall would have done:

```sql
SELECT action, count(*) FROM message_triage GROUP BY action ORDER BY 2 DESC;
```

Where Jev and the generative model disagree about how the customer feels:

```sql
SELECT m.text, m.sentiment AS generative, t.sentiment AS jev
FROM message_triage t JOIN social_messages m ON m.id = t.social_message_id
WHERE m.sentiment IS NOT NULL AND m.sentiment::text <> t.sentiment
ORDER BY t.created_at DESC;
```

What the firewall would have handled that the pipeline escalated instead — worth reading
before switching it on:

```sql
SELECT t.action, m.text, th.escalation_reason
FROM message_triage t
JOIN social_messages m ON m.id = t.social_message_id
JOIN conversation_threads th ON th.id = m.thread_id
WHERE t.action <> 'NONE' ORDER BY t.created_at DESC;
```

Latency and cost:

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS median_ms,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY latency_ms) AS p90_ms,
       sum(input_tokens) AS tokens
FROM message_triage;
```

## Where else it fits

Not built. Each takes a generative judgment and makes it a decision:

1. **Judge retrieved passages before generating.** Ask of each passage whether it contains
   evidence for the question. When none does, hand over without generating — today the model
   writes an answer and then declines it. When some do, send only those: a shorter prompt is
   a faster local reply.
2. **Check the answer before sending it.** Gate 3 is the model's own confidence in its own
   answer. An independent yes/no — is every claim in this reply supported by the passages? —
   would be a real check.
3. **Crawled pages:** keep or skip each one — product, policy and FAQ pages versus login and
   boilerplate. That class of problem once indexed a hidden modal on every page.
4. **Resolved conversations:** "thanks, got it" after an answer suggests resolving.
5. **Analytics:** a topic for every conversation — what customers actually ask about.

What stays generative: the reply itself, the handover brief, and reading photos and voice notes
(Jev reads text only).
