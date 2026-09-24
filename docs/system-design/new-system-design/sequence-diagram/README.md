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
    participant J as Jev (TypeSafe)
    participant T as ThreadService
    participant AR as AgentRoutingService
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
    Note over AI: From here every step is also written to ai_trace_steps,<br/>with its input and output, for the conversation visualizer.

    opt firewall on
        AI->>J: triage(message) — two calls in parallel
        J-->>AI: intent · asks for a person · injection · sentiment
        Note over AI,J: Acts only when sure — greet, thank, or hand over.<br/>Anything else carries on below, unchanged.
    end

    AI->>R: search(question, 5 passages)
    R->>V: cosine nearest neighbour
    V-->>R: passages + similarity
    R-->>AI: best match

    alt best similarity >= 0.25
        AI->>L: complete(system prompt, passages + memory + question)
    else weak retrieval
        Note over AI: Passages dropped as irrelevant.<br/>The model still answers, so a greeting is not escalated.
        AI->>L: complete(system prompt, memory + question)
    end
    L-->>AI: {related, answered, confidence, reply}

    alt answered and confidence >= 0.55
        AI->>M: send reply
        M->>C: delivers the answer
        AI->>DB: store reply, sources, timings
    else weak retrieval and not about the business
        AI->>DB: off-topic streak + 1
        Note over AI: Escalated below 3.<br/>At 3 the conversation is closed.
    else cannot answer
        AI->>T: escalate(thread, reason)
        T->>DB: status = OPEN_FOR_AGENT
        AI->>AR: pickAgent(organization)
        AR-->>AI: least-loaded active agent
        AI->>DB: assign
        AI->>N: escalated(agent, thread, reason)
        N->>DB: write notification row
        N->>A: encrypted Web Push
        AI->>A: email via Resend
        AI->>M: handover notice
        M->>C: "someone will reply shortly"
        A->>DB: takes over and replies
    end

    opt shadow mode (the default)
        AI->>J: triage(message), after the customer has their answer
        J-->>AI: intent · asks for a person · injection · sentiment
        AI->>DB: record what the firewall would have done
    end
```

## What this shows that the data flow diagrams cannot

**Meta is answered first, in step 9.** The webhook returns `200 OK` before a single line of AI
work happens. Meta retries anything it considers slow, and a retry would mean the customer
being answered twice. A DFD has no way to express "this happens before that".

**The transaction boundary.** The event is published *inside* the ingesting transaction but
handled only after it commits, on a different thread pool. An earlier version called the AI
directly from the ingestion path, and it looked up a message the committing transaction had
not released yet — so it silently did nothing.

**Gate 1 changes what the model is given, not whether it is asked.** When nothing in the
knowledge base comes close, the passages are dropped and the model answers from the question
and conversation memory alone. Escalating on weak retrieval by itself would hand every
"hello" to a person, since a greeting matches no policy document well.

**The firewall sits before the model, and only acts when sure.** In `on` mode one Jev
decision settles greetings, thanks, requests for a person and injection attempts before
anything is generated; everything it is unsure of runs down the path below exactly as before.
In shadow mode — the default — the same judgment is made *after* the customer has been
answered, and only recorded, so the evaluation can never slow a reply.

**Escalation is a dozen steps, not one.** Escalating means changing thread state, choosing an
agent by current load, recording the assignment, writing a notification row, pushing to that
agent's devices, emailing them, *and* telling the customer someone is coming — because a
conversation that goes quiet after "let me check" is worse than no promise at all.

## Matching the code

| Diagram step | Source |
| :--- | :--- |
| Signature verification, then 200 | `WebhookController.handleWebhook` |
| Thread attach before save | `MetaMessageParser.saveMessage` → `ThreadService.attach` |
| Event after commit | `MessageIngested` + `MessageIngestedListener` |
| Gate 1 at 0.25 | `app.ai.min-similarity` |
| Gate 3 at 0.55 | `app.ai.min-confidence` |
| Weak retrieval still calls the model | `AiReplyService.reply` — `weakContext` |
| Off-topic streak, closed at 3 | `AiReplyService.handleUnrelated` |
| Least-loaded assignment | `AgentRoutingService.pickAgent` |
| Email to the agent | `AiReplyService.notifyAssignee` → Resend |
| Firewall, on mode | `AiReplyService.firewall` → `MessageTriageService.triage` |
| Firewall, shadow mode | `MessageIngestedListener`, after the reply |
| Notification row then push | `AgentNotificationService.deliver` |
