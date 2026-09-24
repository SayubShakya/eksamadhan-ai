# Class diagram — Semester 2

Two views: the domain model, then the services that act on it. Compare with the
[reconstructed Semester 1 class diagram](../../old-system-design/class-diagram/).

<!-- images -->
![Domain model](class-diagram-domain-model.png)
![Service layer](class-diagram-service-layer.png)

*Rendered from the Mermaid source below.*

## 1. Domain model

```mermaid
classDiagram
    direction TB

    class Organization {
        +UUID id
        +String name
        +String apiKey
        +OffsetDateTime createdAt
    }

    class User {
        +UUID id
        +Organization organization
        +String email
        +String passwordHash
        +String firstName
        +String lastName
        +UserRole role
        +UserStatus status
        +String avatar
        +OffsetDateTime lastLoginAt
        +boolean systemAdmin
        +displayName() String
    }

    class Invitation {
        +UUID id
        +Organization organization
        +String email
        +UserRole role
        +String token
        +UUID invitedBy
        +OffsetDateTime expiresAt
        +OffsetDateTime acceptedAt
        +isUsable() boolean
    }

    class SocialPage {
        +UUID id
        +Organization organization
        +String pageId
        +String pageName
        +String platform
        +String instagramBusinessId
        +String accessToken
    }

    class ConversationThread {
        +UUID id
        +SocialPage socialPage
        +String customerId
        +String customerName
        +String tenantId
        +String assignedAgentId
        +ThreadStatus status
        +String escalationReason
        +String sentiment
        +int offTopicStreak
        +boolean unrelated
        +String summary
        +int unanswered
        +ZonedDateTime escalatedAt
        +ZonedDateTime resolvedAt
    }

    class SocialMessage {
        +UUID id
        +ConversationThread thread
        +SocialPage socialPage
        +String metaMessageId
        +String senderId
        +String recipientId
        +String text
        +String direction
        +String attachmentType
        +String attachmentUrl
        +String transcript
        +Sentiment sentiment
        +boolean aiGenerated
        +Double aiConfidence
        +String aiSources
        +Integer aiGeneratedMs
        +Integer aiWaitedMs
        +UUID sentByUserId
        +ZonedDateTime timestamp
    }

    class KnowledgeSource {
        +UUID id
        +Organization organization
        +String title
        +KnowledgeSourceType sourceType
        +KnowledgeSourceStatus status
        +String content
        +String sourceUrl
        +String imagePath
        +String caption
        +String error
        +int chunkCount
    }

    class KnowledgeChunk {
        +UUID id
        +KnowledgeSource source
        +Organization organization
        +int ordinal
        +String content
        +Vector embedding
        +String embeddingModel
    }

    class AiTraceStep {
        +UUID id
        +UUID socialMessageId
        +Long seq
        +String kind
        +String title
        +String outcome
        +String input
        +String output
        +Integer durationMs
        +OffsetDateTime createdAt
    }

    class MessageTriage {
        +UUID id
        +UUID socialMessageId
        +String mode
        +String intent
        +Double intentConfidence
        +Double wantsHuman
        +Double injection
        +String sentiment
        +Double sentimentConfidence
        +String action
        +Integer latencyMs
        +Integer inputTokens
        +OffsetDateTime createdAt
    }

    class MessageEmbedding {
        +UUID id
        +UUID socialMessageId
        +UUID threadId
        +String tenantId
        +String content
        +Vector embedding
        +String embeddingModel
    }

    class PushSubscription {
        +UUID id
        +User user
        +String endpoint
        +String p256dh
        +String auth
        +String userAgent
    }

    class Notification {
        +UUID id
        +User user
        +UUID threadId
        +Kind kind
        +String title
        +String body
        +String url
        +OffsetDateTime readAt
    }

    class UserRole {
        <<enumeration>>
        OWNER
        ADMIN
        AGENT
        +canManageTeam() boolean
    }

    class UserStatus {
        <<enumeration>>
        ACTIVE
        INVITED
        DISABLED
    }

    class ThreadStatus {
        <<enumeration>>
        AI_HANDLING
        OPEN_FOR_AGENT
        AGENT_HANDLING
        RESOLVED
        +aiMayReply() boolean
    }

    class Sentiment {
        <<enumeration>>
        POSITIVE
        NEUTRAL
        NEGATIVE
        ANGRY
        +warrantsHuman() boolean
    }

    class KnowledgeSourceType {
        <<enumeration>>
        TEXT
        PDF
        IMAGE
        URL
    }

    class KnowledgeSourceStatus {
        <<enumeration>>
        PENDING
        INDEXING
        READY
        FAILED
    }

    Organization "1" o-- "*" User
    Organization "1" o-- "*" Invitation
    Organization "1" o-- "*" SocialPage
    Organization "1" o-- "*" KnowledgeSource
    SocialPage "1" o-- "*" ConversationThread
    ConversationThread "1" o-- "*" SocialMessage
    KnowledgeSource "1" o-- "*" KnowledgeChunk
    User "1" o-- "*" PushSubscription
    User "1" o-- "*" Notification
    SocialMessage "1" -- "0..1" MessageEmbedding : by socialMessageId
    SocialMessage "1" -- "0..1" MessageTriage : by socialMessageId
    SocialMessage "1" -- "*" AiTraceStep : by socialMessageId

    User --> UserRole
    User --> UserStatus
    ConversationThread --> ThreadStatus
    SocialMessage --> Sentiment
    KnowledgeSource --> KnowledgeSourceType
    KnowledgeSource --> KnowledgeSourceStatus
```

> `embedding` is declared `Vector` above for diagram clarity. The Java type is `float[]`,
> mapped by Hibernate to a pgvector `vector(1536)` column with
> `@JdbcTypeCode(SqlTypes.VECTOR)` and `@Array(length = 1536)`.

### The behaviour on the enums is the part worth reading

`ThreadStatus.aiMayReply()` returns true for `AI_HANDLING` **and** `OPEN_FOR_AGENT`. That
looks like a bug and is not: when the AI escalates, the customer is still there and may keep
typing. If escalation silenced the AI, one weak question would mute the bot for the rest of
the conversation — which is exactly what happened before this was fixed.

`UserRole.canManageTeam()` is the single authorisation predicate for OWNER and ADMIN, used by
every endpoint that invites, removes, reassigns or edits the knowledge base.

`Sentiment.warrantsHuman()` is true only for `ANGRY`, deliberately distinct from `NEGATIVE` —
"my parcel is late" is negative and answerable; abuse is not.

## 2. Service layer

```mermaid
classDiagram
    direction LR

    class AiReplyService {
        -double minSimilarity
        -double minConfidence
        -int offTopicLimit
        +reply(messageId, pageId)
        +escalateAfterFailure(messageId, reason)
        -buildPrompt(question, passages, thread)
        -contextBlock(passages, maxChars)$
        -escalate(thread, page, customerId, reason)
        -handleUnrelated(thread, page, customerId)
    }

    class RetrievalService {
        +search(org, query, topK) List~Passage~
    }

    class LlmClient {
        -int maxAttempts
        +complete(system, user) String
        +describeImage(bytes, type) String
        +transcribe(mp3) String
        -post(body) Map
        -worthRetrying(status)$ boolean
    }

    class EmbeddingClient {
        -LinkedHashMap cache
        +embed(text) Vector
        +embedAll(texts) List~Vector~
    }

    class ConversationMemoryService {
        +remember(messageId)
        +recallForThread(threadId, query, limit)
        +backfillAsync(tenantId)
    }

    class ThreadService {
        +attach(message, page, customerId)
        +takeOver(threadId, agentId)
        +assign(threadId, agent)
        +returnToAi(threadId)
        +escalate(threadId, reason)
        +resolve(threadId)
        +visibleTo(user) List~ConversationThread~
    }

    class AgentRoutingService {
        +pickAgent(organization) Optional~User~
    }

    class ConversationSummaryService {
        +scheduleWhenQuiet(threadId)
        +summariseNow(threadId)
    }

    class SentimentService {
        +analyse(messageId) Sentiment
    }

    class KnowledgeService {
        +create(org, title, type)
        +crawlAsync(orgId, startUrl)
        +indexAsync(sourceId, text)
        -index(sourceId, text)
    }

    class TextChunker {
        +chunk(text) List~String~
    }

    class KnowledgeController {
        +upload(file, title) SourceView
    }

    class DocumentTextExtractor {
        +extract(file) String
        +typeOf(file) KnowledgeSourceType
    }

    class WebCrawler {
        +crawl(startUrl) List~Page~
        -readable(document) String
        -content(document) Element
    }

    class AgentNotificationService {
        +escalated(agent, thread, reason)
        +assigned(agent, thread, by)
        +customerReplied(messageId)
        +nobodyToAssign(org, thread, reason)
        -deliver(agent, kind, threadId, title, body, url)
    }

    class PushService {
        +notify(user, notification)
        -send(device, payload) boolean
    }

    class WebPushCrypto {
        +encrypt(uaKey, auth, plaintext)$ byte[]
        +vapidHeader(endpoint, subject, pub, priv)$ String
    }

    class EmailService {
        +send(to, subject, html, text) Result
    }

    class MetaService {
        +sendMessage(recipient, text, token)
        +sendAttachment(recipient, file, type)
        +getConversations(pageId, token)
        +subscribeToWebhooks(pageId, token)
    }

    class SyncService {
        +syncPageHistory(page)
        +answerMissed(page)
        +saveOutboundMessage(...)
    }

    class MessageTriageService {
        +triage(messageId) Optional~MessageTriage~
        +mode() Mode
        ~decide(triage) Action
        -describe(organization) String
    }

    class TraceRecorder {
        +step(messageId, kind, title, outcome, input, output)
        +here(kind, title, outcome, input, output)
        +begin(messageId)
        +end()
    }

    class SystemAdminBootstrap {
        +ensureSystemAdmin()
    }

    class SystemController {
        +messages(limit, q) List~MessageSummary~
        +trace(id) Trace
    }

    class TypeSafeClient {
        +evaluate(state, questions) JsonNode
        +evaluateAsync(state, questions) Mono~JsonNode~
    }

    class MessageIngestedListener {
        +onMessageIngested(event)
    }

    MessageIngestedListener --> AgentNotificationService
    MessageIngestedListener --> AiReplyService
    MessageIngestedListener --> SentimentService
    MessageIngestedListener --> ConversationMemoryService
    MessageIngestedListener --> MessageTriageService

    AiReplyService --> RetrievalService
    AiReplyService --> MessageTriageService
    SentimentService --> MessageTriageService
    MessageTriageService --> TypeSafeClient
    AiReplyService --> TraceRecorder
    MessageTriageService --> TraceRecorder
    SentimentService --> TraceRecorder
    AiReplyService --> LlmClient
    AiReplyService --> ConversationMemoryService
    AiReplyService --> ThreadService
    AiReplyService --> AgentRoutingService
    AiReplyService --> ConversationSummaryService
    AiReplyService --> AgentNotificationService
    AiReplyService --> EmailService
    AiReplyService --> MetaService
    AiReplyService --> SyncService

    RetrievalService --> EmbeddingClient
    ConversationMemoryService --> EmbeddingClient
    SentimentService --> LlmClient
    ConversationSummaryService --> LlmClient

    KnowledgeService --> TextChunker
    KnowledgeService --> EmbeddingClient
    KnowledgeService --> WebCrawler
    KnowledgeController --> DocumentTextExtractor
    KnowledgeController --> KnowledgeService

    AgentNotificationService --> PushService
    PushService ..> WebPushCrypto : static calls
    SyncService --> MetaService
```

### Notes for redrawing

- `AiReplyService` is the decision engine, not a thin wrapper. The three gates, the escalation
  reasons, the off-topic streak and the prompt all live there, which is why it is the largest
  class in the project.
- `LlmClient` is deliberately thin — it knows how to get text out of a model and nothing about
  the product. It retries transient provider failures, and refuses to retry timeouts or bad
  requests.
- `WebPushCrypto` is static and pure, so it can be tested against RFC 8291's published worked
  example rather than by hoping.
- `MessageIngestedListener` is where the asynchronous boundary sits — see the
  [level 1 data flow diagram](../workflow-diagram/Level%201%20Data%20Flow%20Diagram/).

### Against Semester 1

The old design had five backend components and no domain behaviour at all. The two additions
that matter are `ConversationThread` with its status machine, which did not exist as a concept,
and the split of "Knowledge Engine / RAG" into an **ingestion** path (source → chunker →
embeddings) and a **retrieval** path (query → embedding → nearest neighbour → prompt), which
turn out to be different problems with different failure modes.
