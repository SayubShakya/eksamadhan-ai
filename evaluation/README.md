# Evaluation

How the four graded targets (report section 1.4) and the load test (objective 5) are measured.
Nothing here changes how the application behaves.

| Target | Measured by | Spends credit |
| :--- | :--- | :--- |
| AI reply latency < 2 s | `latency.sql`, over the live database | no |
| Handover alert latency < 3 s | `latency.sql` | no |
| AI deflection 60 to 65% | `latency.sql` | no |
| RAG answer accuracy 85% | `AccuracyEvaluationTest` (JUnit, tagged `evaluation`) | yes, a little |
| Load test (objective 5) | `loadtest.mjs` | only cached knowledge searches |
| Questions the knowledge base missed | `knowledge-gaps.sql` | no |

The scripts that run against the live system (SQL, the load test) live in this folder because
they are not part of the Maven build. The accuracy runner is a JUnit test, in
`backend/src/test/java/io/eksamadhan/evaluation/`, because it has to call the services in
process to reach the real pipeline without sending anything; its question set is beside it in
`backend/src/test/resources/evaluation/`.

## Reply, alert and deflection: `latency.sql`

```bash
docker exec -i eksamadhan-postgres psql -U eksamadhan -d eksamadhan < evaluation/latency.sql
```

Read-only. What each figure is made of:

- **Reply latency** runs from the customer's message as Meta timestamped it to the AI's reply
  being accepted by Meta and stored: `ai_waited_ms + ai_generated_ms` on the AI's outbound
  message. `ai_waited_ms` is webhook delivery (Meta, the Vercel proxy and the tunnel in
  development), Jev triage and any queue wait; `ai_generated_ms` is retrieval (embedding plus
  pgvector), the chat model and the Meta send. There is no deliberate debounce. The
  breakdown comes from `ai_trace_steps` (Jev, retrieval and model steps carry `duration_ms`;
  the Meta send is the gap between the "Reply sent" step and the stored message). The
  dashboard's figure (`AnalyticsService.replyTimes`) is printed too: it also counts greetings
  and handover notices, and measures from the latest customer message before each reply.
- **Handover alert latency** is printed two ways. A: the escalation decision (the HANDOVER
  trace step) to the alert row in `notifications`, which is written just before the push is
  handed to its executor. B: the customer's message to that alert, which also contains the
  model call that decided to escalate. Arrival on the device is not recorded anywhere.
- **Deflection** is per conversation, as on the dashboard (never escalated, conversations closed
  as unrelated left out), and per customer message the AI ran on (answered versus escalated).

## Accuracy: `AccuracyEvaluationTest`

```bash
set -a; . ./.env; . backend/.env; set +a
cd backend && mvn test -Pevaluation -Dtest=AccuracyEvaluationTest
```

Each question in `accuracy-questions.json` goes through `AiReplyService` as a new customer in a
new conversation on the page whose workspace holds the "Parampara Silver Jewelry" knowledge:
the real embedding call, pgvector search, prompt and chat model (whatever `AI_CHAT_PROVIDER`
says). Meta, alerts, email, live events, Jev and conversation memory are stand-ins, and each
question runs in its own rolled-back transaction, so nothing is sent and nothing is left in the
database. The plain `mvn test` leaves it out (`excludedGroups` in `pom.xml`).

The set has 54 questions: 16 copied word for word from real customer messages, 23 written from
the knowledge text, and 15 whose right outcome is a handover (not covered, off-topic, an order
only a person can take, a prompt injection). Expected facts are copied from the knowledge text.
Each result is one of: correct answer (every fact present), correct escalation, wrong answer
(answered when it should have handed over, or a fact missing), wrong escalation (handed over a
question the knowledge answers). Results go to `backend/target/evaluation/accuracy.md`.

## Load test: `loadtest.mjs`

```bash
node evaluation/loadtest.mjs                  # 30 users for 60 s
VUS=50 DURATION=60 node evaluation/loadtest.mjs
```

Node 18 or later, no packages. It writes a throwaway workspace straight into the database
(users with `.invalid` addresses, no sign-up, so no email; a page with no access token; 60
conversations of 20 messages; a copy of the shop's knowledge with its embeddings), then:

1. every user signs in at once, each from its own device address;
2. checks that the per-device sign-in limit still refuses the 21st attempt in a minute;
3. for the run's duration, each user polls like an open inbox (`/api/threads` and
   `/api/messages` every 1.5 s, `/api/auth/status` every 5 s, a knowledge search every 10 s),
   while 5 senders post correctly signed webhooks for a page id no workspace owns, so they are
   verified, parsed and dropped.

There is no per-conversation endpoint: opening a conversation in the inbox shows messages the
`/api/messages` poll already fetched, so that poll is what "thread open" costs. Knowledge search
queries come from a fixed list of eight, so after the first round they hit the embedding cache.
Everything the run created is deleted at the end, also on Ctrl-C, and the count of rows left is
printed. Results also go to `backend/target/evaluation/loadtest-<run>.json`.

## Knowledge gaps: `knowledge-gaps.sql`

```bash
docker exec -i eksamadhan-postgres psql -U eksamadhan -d eksamadhan < evaluation/knowledge-gaps.sql
```

Every customer message handed over as "not covered by the knowledge base", in the customer's
words, once each, with how often and when it was asked. Message text only.
