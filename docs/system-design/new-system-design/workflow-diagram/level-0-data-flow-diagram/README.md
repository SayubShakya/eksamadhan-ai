# Data flow diagram — level 0 (context)

The whole system as one process, with the four external entities that exchange data with it.
Compare with [Semester 1](../../../old-system-design/workflow-diagram/level-0-data-flow-diagram/Picture1.png).

<!-- images -->
![Level 0 data flow diagram](level-0-data-flow-diagram.png)

*Rendered from the Mermaid source below.*

```mermaid
flowchart LR
    customer["End User<br/>(customer)"]
    agent["Support Agent"]
    admin["Account Owner<br/>/ Admin"]
    meta["Meta platform<br/>Facebook · Instagram"]

    system((("0<br/>EkSamadhan AI<br/>system")))

    customer -->|"question, voice note, photo"| meta
    meta -->|"inbound message webhook"| system
    system -->|"AI answer, handover notice"| meta
    meta -->|"delivered message"| customer

    admin -->|"business knowledge, page connection, invitations"| system
    system -->|"analytics, retrieval scores, team state"| admin

    agent -->|"replies, take over, hand back, transfer, resolve"| system
    system -->|"inbox, handover brief, alerts"| agent
```

## Reading it against Semester 1

The old level 0 had three external entities — End User, Support Agent, Admin — talking
directly to the system box.

**Meta is now drawn as a fourth external entity, sitting between the customer and the
system.** That is not a cosmetic change. The system never receives a message from a customer:
it receives a webhook from Meta, and it never replies to a customer either — it asks Meta to
deliver. Everything that follows from that is real and was discovered by building it:

- Meta decides whether a message arrives at all. When a webhook is not delivered, the system
  finds the message later by polling, which is why the level 1 diagram has a catch-up flow.
- Meta enforces a 24-hour window for replying to a customer, so an answer written too late is
  refused.
- In development, Meta only delivers messages from accounts registered to the developer app,
  which is why testing requires a second account.

Drawing the customer as if they spoke to the system directly hides all three. The old diagram
did, and that is exactly the class of detail a context diagram exists to expose.
