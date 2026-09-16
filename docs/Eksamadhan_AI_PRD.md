# Eksamadhan AI: Product Requirements Document (PRD)

## 1. Executive Summary
**Eksamadhan AI** is a SaaS platform designed to centralize and automate customer support for e-commerce businesses and service providers. It leverages Generative AI (LLMs) and Vector Databases to provide context-aware responses across Instagram, Facebook, and a proprietary Website Chatbot.

### The Core Differentiator
The **Hybrid Support Model**: The system attempts to resolve queries via an AI Agent using a **RAG (Retrieval-Augmented Generation)** pattern. If the AI cannot resolve a query, detects negative sentiment, or receives a specific trigger, the conversation is seamlessly handed over to a live human support agent via a unified routing system.

### Real-Time Connectivity
To ensure responsiveness, the system utilizes **Firebase Cloud Messaging (FCM)** to provide real-time alerts to human agents when their intervention is required, and to web-widget users when a reply is received.

---

## 2. Target Audience
1. **SME Business Owners**: Selling physical products (electronics, clothing) or services who need to automate repetitive queries.
2. **Customer Support Teams**: Teams managing high volumes of social media DMs and website inquiries who need a unified inbox.
3. **End Consumers**: Shoppers asking questions via Instagram DMs, Facebook Messenger, or the store's website.

---

## 3. User Roles
| Role | Description |
| :--- | :--- |
| **Account Admin (Owner)** | Manages subscriptions, connects social accounts (Meta), uploads knowledge base data, and manages agent seats. |
| **Support Agent** | A human user handling escalated queries. Maintains an "Availability Status" (Online/Busy) and receives FCM notifications. |
| **End User (Customer)** | The individual interacting with the bot via FB, Insta, or the Web Widget. |

---

## 4. Key Feature Modules

### 4.1. Authentication & Onboarding
* **Sign Up/Login**: Support for Email/Password and Social Login (Google).
* **Organization Setup**: Workspace creation allowing the Admin to invite other agents via email.

### 4.2. Social Media Integration (The "Connect" Layer)
* **Meta Graph API Integration**: OAuth flow to grant permissions for Instagram Business and Facebook Pages.
* **Scopes**: `pages_messaging`, `instagram_basic`, `instagram_manage_messages`.
* **Webhooks**: Real-time listeners for incoming messages from connected pages.

### 4.3. The Knowledge Engine (AI & Vector DB)
* **Context Ingestion**: Admin interface to input "Business Knowledge" (Text input, PDF upload, or URL scraping).
* **Vector Database (Memory)**: Data is chunked, embedded (OpenAI/Gemini), and stored in a Vector DB (Pinecone/Milvus) for semantic retrieval.
* **RAG Pipeline**: `Incoming Query` -> `Semantic Search` -> `Retrieve Context` -> `LLM Prompting` -> `Response Generation`.

### 4.4. The Web Chat Widget
* **Embeddable Script**: Generates a generic JS snippet for Shopify/WordPress integration.
* **Widget UI**: Customizable chat bubble.
* **Client-Side Notifications**: Uses Service Workers/FCM to notify the web visitor of a reply if they have tabbed away.

### 4.5. Hybrid Handover System (The "Escalation" Layer)
* **Triggers for Handover**:
    1. **Sentiment Analysis**: User sentiment drops below threshold (angry/frustrated).
    2. **Confidence Score**: AI confidence < 70% (configurable).
    3. **Explicit Request**: User types "Talk to a human", "Support", etc.
* **Agent Availability Logic**: Agents toggle "Online/Offline".
* **Routing**: Round Robin distribution to "Online" agents.

### 4.6. Notification Infrastructure (FCM Integration)
* **Agent Alert**: When a ticket is Escalated, the assigned Human Agent receives an FCM Push Notification.
* **Web User Alert**: When the Web Widget receives a reply (AI or Human) and the tab is inactive, the End User receives a Web Push Notification.

### 4.7. Unified Agent Dashboard
* **The "Inbox"**: A single interface displaying threads from Facebook, Instagram, and Web.
* **Seamless Intervention**: Agents view AI conversation history. When the Agent types, the AI is paused for that thread (**Human-in-the-loop**).

---

## 5. Functional Requirements (User Stories)
| ID | As a... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| **FR-01** | Admin | Connect FB and Instagram pages | The bot can read and reply to DMs automatically. |
| **FR-02** | Admin | Upload text/docs about products | The AI knows what I sell and what my policies are. |
| **FR-03** | Admin | Generate a chat widget script | I can embed the support bot on my website. |
| **FR-04** | Admin | Invite Support Agents via email | My team can help answer questions. |
| **FR-05** | Agent | Toggle status to "Available" | The system knows I am ready to take escalated chats. |
| **FR-06** | Agent | View a unified inbox | I don't have to switch between social platforms. |
| **FR-07** | System | Detect "low confidence" queries | The bot avoids hallucinations and hands over to a human. |
| **FR-08** | System | Route a chat to a free agent | The workload is distributed evenly. |
| **FR-09** | Agent | Receive FCM Notification | I am alerted even if the dashboard tab is backgrounded. |
| **FR-10** | End User | Receive Web Push Notification | I know when the team has replied to my web chat. |

---

## 6. Technical Architecture

### 6.1. Tech Stack Recommendation
> Superseded by §5.2 of the submitted contextual report — the stack below reflects
> the graded document, not the original open options.

* **Frontend**: React.js + Vite (Dashboard and embeddable Widget).
* **Backend**: **Java 21 / Spring Boot 3** — chosen over Node.js for multithreaded
  handling of concurrent message volume, memory management and long-term stability.
* **Database**: PostgreSQL.
* **Vector DB**: Pinecone.
* **AI/LLM**: OpenAI API (latest GPT models).
* **Notifications**: Firebase Cloud Messaging (FCM).
* **Auth**: OAuth 2.0 + JWT.
* **Hosting**: PrabhuHost.

### 6.2. Data Flow (Escalation with Notification)
1. **Incoming Message**: User sends message.
2. **AI Processing**: System determines AI cannot answer (Low Confidence).
3. **State Change**: Ticket status updates to `OPEN_FOR_AGENT`.
4. **Routing**: System selects Agent ID 123 (Status: Online).
5. **Notification Trigger**: Backend sends payload to FCM:
```json
{
  "to": "agent_123_device_token",
  "notification": {
    "title": "New Escalation",
    "body": "Customer requires assistance on Instagram."
  },
  "data": { "threadId": "xyz" }
}
```

---

## 7. UI/UX Considerations
* **Dashboard**: Clean, "Inbox-zero" philosophy.
* **Chat Interface**:
    * **Grey Bubbles**: AI Replies.
    * **Blue Bubbles**: Human Agent Replies.
    * **System Notes**: *"Chat handed over to Agent [Name]"* (Internal only).
* **Notification Permissions**: Dashboard must explicitly ask Agents for permission upon first login.

---

## 8. Success Metrics
1. **Deflection Rate**: % of queries solved by AI without human intervention (Target: >60%).
2. **Response Time**: Average time for a human agent to pick up an escalated ticket.
3. **Integration Success**: % of users successfully linking Meta accounts without OAuth errors.
