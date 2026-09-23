# Class diagram — Semester 1 (reconstructed)

> **This diagram is reconstructed, not recovered.** No class diagram was produced in
> Semester 1. This one is derived from that semester's
> [ER diagram](../er-diagram/Picture1.png) and
> [component diagram](../system-architecture/Picture1.png), and exists only so the Semester 2
> class diagram has something fair to be compared against. Everything in it is implied by
> those two documents; nothing is invented from the built code.

<!-- images -->
![Semester 1 domain model, reconstructed](class-diagram-domain-model-reconstructed.png)
![Semester 1 service components, reconstructed](class-diagram-service-components-reconstructed.png)

*Rendered from the Mermaid source below.*

## Domain model as designed in Semester 1

```mermaid
classDiagram
    class Tenant {
        +int id
        +String name
        +String apiKey
    }

    class Role {
        +int id
        +String roleName
    }

    class User {
        +int id
        +String name
        +String email
        +String password
    }

    class SocialPage {
        +int id
        +String pageId
        +String pageName
        +String platform
        +Date connectedAt
    }

    class SocialMessage {
        +int id
        +String metaMessageId
        +String senderId
        +String recipientId
        +String text
        +String direction
        +String platform
        +int isRead
    }

    class KnowledgeDocument {
        +int id
        +String docName
        +String content
    }

    Tenant "1" --> "*" User : has members
    Tenant "1" --> "*" SocialPage : owns
    Tenant "1" --> "*" KnowledgeDocument : contains
    Tenant "1" --> "*" SocialMessage : global logs
    Role "1" --> "*" User : assigned
    SocialPage "1" --> "*" SocialMessage : tracks
```

## Service components as designed in Semester 1

The component diagram named five backend blocks and four external dependencies. Drawn as
classes, the intended responsibilities were:

```mermaid
classDiagram
    class ApiGatewayController {
        +handleRestRequest()
        +handleWebhook()
        +handleWebSocket()
    }

    class AuthenticationMiddleware {
        +authenticate()
        +authorise()
    }

    class KnowledgeEngineRAG {
        +embedDocument()
        +semanticSearch()
        +generateAnswer()
    }

    class RoutingEscalation {
        +scoreConfidence()
        +escalate()
        +roundRobinAssign()
    }

    class SocialMediaConnector {
        +receiveMessage()
        +sendMessage()
    }

    class PineconeClient {
        +upsertVector()
        +queryVector()
    }

    class LlmClient {
        +complete()
    }

    class FcmClient {
        +sendPush()
    }

    ApiGatewayController --> AuthenticationMiddleware
    AuthenticationMiddleware --> KnowledgeEngineRAG
    AuthenticationMiddleware --> RoutingEscalation
    AuthenticationMiddleware --> SocialMediaConnector
    KnowledgeEngineRAG --> PineconeClient
    KnowledgeEngineRAG --> LlmClient
    RoutingEscalation --> FcmClient
```

## What this reconstruction shows about the original design

Three things stand out once the Semester 1 model is drawn as classes, and all three changed
in Semester 2:

1. **There is no conversation.** Messages hang off a page and a tenant, with nothing between
   them. Nothing owns a conversation, nothing tracks its state, and there is therefore nowhere
   to record that the AI has handed it to a person. The whole handover feature has no home in
   this model.
2. **Roles are a table.** `Role` is a joined entity, which is the shape you use when roles are
   data an administrator edits. This project has exactly three fixed roles.
3. **Knowledge is one field.** `KnowledgeDocument.content` is a single `varchar(5000)` column.
   There are no passages and no vectors, so the retrieval the design depends on has nothing to
   retrieve from — the embeddings were assumed to live entirely inside Pinecone.

See [`../../new-system-design/class-diagram/`](../../new-system-design/class-diagram/) for
what was built, and
[`../../new-system-design/README.md`](../../new-system-design/README.md) for the full
comparison.
