# Use case diagram — Semester 2

Compare with [Semester 1](../../old-system-design/use-case/Picture1.png), which had four
actors and eight use cases. Dashed items are designed but **not built**.

<!-- images -->
![Account Owner / Admin](use-case-diagram-account-owner-admin.png)
![Support Agent](use-case-diagram-support-agent.png)
![End User and Meta](use-case-diagram-end-user-and-meta.png)
![AI System](use-case-diagram-ai-system.png)
![System Admin](use-case-diagram-system-admin.png)

*Rendered from the Mermaid source below.*

Mermaid cannot lay out a classic UML use-case diagram, so the actors are split into five
views rather than crammed into one. Redrawn in Visual Paradigm they belong on a single canvas,
with these actors down the left and the ovals inside one system boundary.

### Account Owner / Admin

```mermaid
flowchart LR
    owner(("Account Owner<br/>/ Admin"))
    subgraph s1["EkSamadhan AI platform"]
        a1["Connect Facebook / Instagram page<br/>FR-01"]
        a2["Add business knowledge<br/>text · PDF · image · website crawl<br/>FR-02"]
        a3["Invite support agents<br/>FR-04"]
        a4["View analytics<br/>deflection · reply time · by channel"]
        a5["Test what the AI would retrieve"]
        a6["View unified inbox<br/>FR-06"]
        a7["Generate website widget script<br/>PLANNED · FR-03"]
        a8["Sign up and sign in with Google"]
    end
    owner --- a1
    owner --- a2
    owner --- a3
    owner --- a4
    owner --- a5
    owner --- a6
    owner --- a8
    owner -.- a7
    style a7 stroke-dasharray: 5 5
```

### Support Agent

```mermaid
flowchart LR
    agent(("Support Agent"))
    subgraph s2["EkSamadhan AI platform"]
        b1["View unified inbox<br/>FR-06"]
        b2["Reply to a customer<br/>text · photo · voice note"]
        b3["Take over a conversation"]
        b4["Transfer to a colleague"]
        b5["Read the handover brief"]
        b6["Resolve a conversation"]
        b10["Hand back to the AI"]
        b11["Review the Spam tab<br/>mark a conversation not spam"]
        b12["See priority and sentiment"]
        b13["Join from an invite with Google<br/>no password to create"]
        b7["Enable notifications on this device"]
        b8["Receive alert when needed<br/>FR-09"]
        b9["Toggle availability<br/>PLANNED · FR-05"]
    end
    agent --- b1
    agent --- b2
    agent --- b3
    agent --- b4
    agent --- b5
    agent --- b6
    agent --- b10
    agent --- b11
    agent --- b12
    agent --- b13
    agent --- b7
    agent --- b8
    agent -.- b9
    style b9 stroke-dasharray: 5 5
```

### End User and Meta

```mermaid
flowchart LR
    customer(("End User<br/>customer"))
    meta(("Meta<br/>external system"))
    subgraph s3["EkSamadhan AI platform"]
        c1["Send a message"]
        c2["Receive an answer"]
        c3["Notify web visitor of a reply<br/>PLANNED · FR-10"]
    end
    customer --- c1
    customer --- c2
    customer -.- c3
    meta --- c1
    meta --- c2
    style c3 stroke-dasharray: 5 5
```

### AI System

```mermaid
flowchart LR
    ai(("AI System"))
    subgraph s4["EkSamadhan AI platform"]
        d1["Answer from the knowledge base<br/>FR-07"]
        d2["Transcribe a voice note"]
        d3["Read a photo"]
        d4["Judge sentiment<br/>Jev"]
        d5["Hand over to a human<br/>FR-07"]
        d6["Route to the least-loaded agent<br/>FR-08"]
        d7["Write the handover brief"]
        d8["Close an off-topic conversation"]
        d9["Alert the assigned agent<br/>FR-09"]
        d10["Triage a message<br/>Jev firewall"]
        d11["Flag a spam conversation"]
        d12["Set the priority 1–3"]
    end
    ai --- d10
    ai --- d1
    ai --- d2
    ai --- d3
    ai --- d4
    ai --- d5
    ai --- d8
    d1 -.->|"extends"| d5
    d5 -.->|"includes"| d6
    d5 -.->|"includes"| d7
    d6 -.->|"includes"| d9
    d10 -.->|"extends"| d5
    d10 -.->|"includes"| d4
    d10 -.->|"includes"| d11
    d10 -.->|"includes"| d12
```

### System Admin

The platform operator, above the workspaces. Made only from configuration — no signup,
invitation or profile edit can create one — because this actor reads every workspace's
conversations.

```mermaid
flowchart LR
    sa(("System Admin"))
    subgraph s5["EkSamadhan AI platform"]
        e1["Browse customer messages<br/>across every workspace"]
        e2["See a message's AI flow<br/>step by step"]
        e3["Open a step's input and output<br/>prompt · passages · reply · judgments"]
        e4["See why it was handed over<br/>and to whom"]
    end
    sa --- e1
    sa --- e2
    e2 -.->|"includes"| e3
    e2 -.->|"includes"| e4
```

## Requirement coverage

| ID | Requirement | State |
| :--- | :--- | :--- |
| FR-01 | Admin connects Facebook and Instagram pages | **Built** |
| FR-02 | Admin uploads knowledge about products and policies | **Built** — and extended to images and website crawling |
| FR-03 | Admin generates a chat widget script | Planned |
| FR-04 | Admin invites support agents by email | **Built** |
| FR-05 | Agent toggles availability | Planned |
| FR-06 | Agent views a unified inbox | **Built** |
| FR-07 | System detects low confidence and hands over | **Built** — three gates, not one |
| FR-08 | System routes a chat to a free agent | **Built** — least-loaded rather than round-robin |
| FR-09 | Agent receives a Web Push notification | **Built** |
| FR-10 | End user receives a push about a web-chat reply | Planned, depends on FR-03 |

## What changed from Semester 1

**Five actors, not four.** Meta is now drawn as an external system actor, because the platform
does not merely "have" social accounts — Meta delivers every inbound message, enforces a
24-hour reply window, and can stop delivering, which is a real dependency that the old diagram
hid inside one box labelled "Connect Social Accounts".

**The AI system does more than auto-reply.** Semester 1 gave it two use cases. It now
transcribes voice notes, reads photos, judges sentiment, writes the handover brief, picks the
agent to hand to, and closes conversations that are not about the business at all.

**"Toggle Availability" moved from built to planned.** It was implemented in Semester 1's
design and even appeared in the UI, but the control was removed because nothing consumed it —
routing considers every active member. It belongs back the moment routing respects it, which
is why it is drawn dashed rather than deleted.

**New cases the PRD never listed**, added because building the thing revealed the need:
transfer a conversation to a colleague, read the automatically-written handover brief, enable
notifications per device, view analytics, and test what the AI would retrieve for a question
before trusting it in front of customers.
