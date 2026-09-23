# Sequence diagram — reply or escalate

The path a customer's message takes, in order, from Messenger to either an AI answer or a
human being alerted. This is the behaviour the project is named for, and the one
[`docs/FINAL_REPORT.md`](../../../FINAL_REPORT.md) §6 asks for by name.

Semester 1 produced no sequence diagram, so there is nothing to compare this against.

<!-- images -->
![Sequence diagram — reply or escalate](sequence-diagram-reply-or-escalate.png)

*Rendered from the Mermaid source below.*

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant M as Meta
    participant P as meta-proxy
    participant W as WebhookController
    participant MP as MetaMessageParser
    participant DB as PostgreSQL
    participant AI as AiReplyService
    participant R as RetrievalService
    participant V as pgvector
    participant L as LlmClient
    participant T as ThreadService
    participant N as AgentNotificationService
    actor A as Support agent

    C->>M: sends a message
    M->>P: webhook POST
    P->>W: forwarded through the tunnel
    W->>W: verify X-Hub-Signature-256
    W->>MP: processWebhookPayload

    MP->>DB: find or create thread
    MP->>DB: save message
    MP-->>W: publish MessageIngested
    W-->>M: 200 OK

    Note over W,M: Answered before any AI work.<br/>Meta retries anything slow.
    Note over MP,AI: Transaction commits here.<br/>Everything below runs on the reply pool.

    MP->>AI: MessageIngested (after commit)
    AI->>R: search(question, top-k 5)
    R->>V: cosine nearest neighbour
    V-->>R: passages + similarity
    R-->>AI: best match

    alt best similarity < 0.25
        Note over AI: Gate 1 fails.<br/>Model is never called.
    else
        AI->>L: complete(system prompt, context + question)
        L-->>AI: {related, answered, confidence, reply}
    end

    alt answered and confidence >= 0.55
        AI->>M: send reply
        M->>C: delivers the answer
        AI->>DB: store reply, sources, timings
    else cannot answer
        AI->>T: escalate(thread, reason)
        T->>DB: status = OPEN_FOR_AGENT
        AI->>T: pick least-loaded active agent
        T->>DB: assign
        AI->>N: escalated(agent, thread, reason)
        N->>DB: write notification row
        N->>A: encrypted Web Push
        AI->>M: handover notice
        M->>C: "someone will reply shortly"
        A->>DB: takes over and replies
    end
```

## What this shows that the data flow diagrams cannot

**Meta is answered first, in step 10.** The webhook returns `200 OK` before a single line of AI
work happens. Meta retries anything it considers slow, and a retry would mean the customer
being answered twice. A DFD has no way to express "this happens before that".

**The transaction boundary.** The event is published *inside* the ingesting transaction but
handled only after it commits, on a different thread pool. An earlier version called the AI
directly from the ingestion path, and it looked up a message the committing transaction had
not released yet — so it silently did nothing.

**Gate 1 short-circuits the model.** When nothing in the knowledge base comes close, the model
is never called at all. That is deliberate: an off-topic question should cost nothing.

**The escalation branch is seven steps, not one.** Escalating means changing thread state,
choosing an agent by current load, writing a notification row, pushing to that agent's
devices, *and* telling the customer someone is coming — because a conversation that goes quiet
after "let me check" is worse than no promise at all.

## Matching the code

| Diagram step | Source |
| :--- | :--- |
| Signature verification, then 200 | `WebhookController.handleWebhook` |
| Thread attach before save | `MetaMessageParser.saveMessage` → `ThreadService.attach` |
| Event after commit | `MessageIngested` + `MessageIngestedListener` |
| Gate 1 at 0.25 | `app.ai.min-similarity` |
| Gate 3 at 0.55 | `app.ai.min-confidence` |
| Least-loaded assignment | `AgentRoutingService.pickAgent` |
| Notification row then push | `AgentNotificationService.deliver` |
