**UNIVERSITY OF BEDFORDSHIRE**
**DEPARTMENT OF COMPUTER SCIENCE AND TECHNOLOGY**
**FINAL YEAR UG PROJECT**
**WEEKLY PROGRESS REPORT FORM**

Student's Name:    Sayub Shakya    Supervisor's Name:    Pawan KC

Project Title:    EkSamadhan-AI: A SaaS Customer Support Platform with Hybrid AI Human Escalation for E Commerce

Date:        24 September 2026    Report No.:    2


**Summary of progress**

The AI now answers customers on Facebook and Instagram by itself, using the shop's own information, and hands the chat to a person when it cannot answer.

**Tasks Done:**

1.    **Login and teams**: Businesses sign up, invite staff, and see only their own chats.
2.    **Knowledge base**: The shop adds its information as text, a PDF, a picture, or a website address that the system reads page by page.
3.    **AI replies**: The AI answers customers using that information. If something is not covered, it says so and a human takes over, instead of guessing.
4.    **Handover**: One person owns a chat at a time and can pass it on, with a short summary written automatically.
5.    **Voice and photos**: Customer's voice notes are transcribed and answered, and photos are read.
6.    **Mood check**: Every message is checked to see whether the customer sounds upset.
7.    **Alerts**: Agents are notified on their phone or laptop, and each device can be switched on or off. A bell in the header lists the same alerts inside the dashboard.
8.    **Search and filters**: Conversations have a reference number and can be searched by name, reference or message text, and filtered by status or channel.
9.    **Reports**: The dashboard shows how much the AI handled on its own (the target is 60%), how fast replies go out, and which channel needs people most.
10.    **System design redrawn**: The diagrams drawn last semester were redrawn to match how the system really works now.
11.    **Testing**: Tests were written that check the important parts of the system on their own, and every feature was also tried by hand with real messages before it was saved to the repository.

**Services and accounts set up:**

1.    **Meta**: the developer app, the Facebook and Instagram page connection, and the link that sends new messages to the system.
2.    **Proxy service**: a purpose-built service on Vercel, giving Meta one fixed address because the development tunnel changes often.
3.    **Resend**: email, for staff invitations and for telling an agent a chat is waiting.
4.    **Web Push (VAPID)**: a signing key pair that was generated for the browser alerts.
5.    **AI model**: Gemma 4 runs on my own computer through Ollama, so replies cost nothing while developing. A paid online model (OpenRouter) is also set up and can be turned on with one setting when the system is deployed.

**Changes from the proposal:**

1.    **Search data**: pgvector inside the existing database instead of Pinecone, so there is one less outside service and customer data is deleted in a single step.
2.    **Alerts**: Web Push with VAPID instead of Firebase, so no Google account is needed and the message is encrypted, meaning the delivery service cannot read it.
3.    **AI model**: Gemma 4 run locally instead of the paid OpenAI API, so it is free per reply and customer messages never leave the machine.


**Plan for next week**

1.    Add "Sign in with Google" using Firebase Authentication, so staff can join without creating another password.
2.    Make the dashboard installable as a Progressive Web App (PWA), so it behaves like a downloaded app.
3.    Match the Figma prototype, and make it work well on a mobile app as well.
4.    Show which agents are online, so chats only go to people who are available.


Supervisor's
comments




  Student's Signature …………………………………                    Date ………………………….

  Supervisor's Signature ……………………………...                    Date ………………………….
