# The Jev firewall

A decision model in front of the reply model. For every customer message, one TypeSafe
**Jev** judgment decides — before anything is generated — whether generating is needed at
all, and reads the customer's sentiment in the same round trip.

Jev is a *decision* model, not a generative one: it returns typed answers (a choice, a
score, a yes/no probability), never prose. That makes it the right tool for the judgments
this pipeline was paying a generative model to make.

## What it decides

Seven questions, in two calls made side by side so the customer waits for one round trip:

| Question | Type | Seen with |
| :--- | :--- | :--- |
| What is the customer doing? greeting · thanks/ack · business question · complaint · wants a human · off-topic · abusive | Choice | the business |
| How do they feel? angry → negative → neutral → positive | Score | the business |
| Is it spam? | Yes/no | the business |
| What kind? customer · promotion · scam · gibberish — the reason an agent is shown | Choice | the business |
| How urgently must the business act? urgent → normal → low, read as priority 1–3 | Score | the business |
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

## Spam and priority

Two labels for agents, applied in every mode because they change no reply on a guess:

- **Priority** is the most urgent customer message in the conversation, and only ever rises —
  a "thanks" after "my order never came" leaves it at 1. Resolving ends it, since the next
  message starts a new conversation.
- **Spam** takes the conversation out of Active into its own tab, and the AI neither answers
  nor escalates it — answering tells a bot the page is live, escalating puts it in front of a
  person. It is decided **per conversation**: a message at or above 0.88 flags it only if
  nobody in the conversation has asked for anything real (a business question, a complaint, a
  request for a person). A flagged conversation returns to Active the moment its customer asks
  for something, and once a person clicks **Not spam** it is never flagged automatically
  again. What Jev judged, how sure it was and the message that decided it are kept and shown.

Measured before building, with the exact state production sends:

| Set | Spam probability |
| :--- | :--- |
| 15 spam messages — prizes, lotteries, work-from-home, follower selling, fake Meta warnings, keyboard mash, English and romanized Nepali | 0.91 – 0.98 |
| 8 held-out look-alikes — "is this a scam? I paid and nothing arrived", "can I resell your products?", "do you sell bitcoin mining rigs?" | ≤ 0.12 |
| 115 distinct real customer messages | ≤ 0.81 |

The highest real ones were "Sgupid bitvhh" (0.81), "Pp" (0.79) and "thikba" (0.66) — a
misspelled insult, a two-letter reply and romanized Nepali for "okay". The gap is 0.10, which
is why the threshold sits in its middle and why the conversation rule exists as well.

Urgency: all 7 synthetic urgent cases (late order, charged twice, broken item, wrong size in
romanized Nepali, a stated deadline, account misuse) scored urgent at ≥ 0.99. Among the real
messages "muji saman nai aayena" (the goods never came, with an insult) and "why are you
sending QR again and again i already paid" came out urgent; price and hours questions normal;
greetings, thanks and insults low. The question asks what has happened to the customer, not
how they write, and that is what made abuse score low and the Nepali complaint score high.

## Sentiment: Jev only

Whenever TypeSafe is configured, the sentiment comes from the triage call and nowhere else —
the local model is no longer asked, so every customer message costs it one call fewer. A
message Jev could not be reached for is left unread and picked up by the sync's backfill.
The generative model reads sentiment only when there is no TypeSafe key at all.

## Modes

`TRIAGE_MODE` in `backend/.env`. In every mode but `off`, Jev judges each message **before**
the reply — about half a second, against several for the reply model — and its labels apply:
sentiment, priority and spam.

- `shadow` (default) — the firewall's own shortcuts (greet, thank, hand over without the
  model) are only recorded, as what it *would* have done.
- `on` — the shortcuts act, before the reply model.
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
