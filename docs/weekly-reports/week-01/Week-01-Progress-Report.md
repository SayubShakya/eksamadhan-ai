**UNIVERSITY OF BEDFORDSHIRE**
**DEPARTMENT OF COMPUTER SCIENCE AND TECHNOLOGY**
**FINAL YEAR UG PROJECT**
**WEEKLY PROGRESS REPORT FORM**

Student's Name:    Sayub Shakya    Supervisor's Name:    Pawan KC

Project Title:    EkSamadhan-AI: A SaaS Customer Support Platform with Hybrid AI Human Escalation for E Commerce

Date:        17 September 2026    Report No.:    1


**Summary of progress**

This week the project environment was set up, and messages from Facebook Messenger and Instagram now flow into the system.

**Tasks Done:**

1.    **Repository**: Created on GitHub, with the supervisor added as a collaborator.
2.    **Development setup**: Java with Spring Boot, a PostgreSQL database, and a React website. Everything builds and runs.
3.    **Facebook and Instagram connected**: Developer account created, the Page linked, and both set up to send new messages to the system automatically.
4.    **Tested with a real message**: A message sent from another account arrived in the database in under a second.
5.    **Inbox built**: Customer names and profile pictures are fetched automatically, react with an emoji, send photos and voice messages, and listen to customers voice notes.
6.    **Design**: Logo made and the dashboard built according to the design.

**Issues and Roadblocks:**

1.    While the app is in development mode, Meta only delivers messages from accounts registered to it, so testing required a second developer account.
2.    The development tunnel address changes every hour, which broke the fixed address Meta requires. This was solved with a small proxy service that keeps the address stable.


**Plan for next week**

1.    Add proper login using OAuth 2.0 and JWT, replacing the temporary account currently hardcoded.
2.    Group messages into conversations with a status, which the handover to a human depends on.
3.    Start the AI side, uploading the shop's documents and answering questions from them.


Supervisor's
comments

1.    Document the progress so that it reflects the report, and the final report develops gradually.
2.    Always test the functionality and make sure it works seamlessly.


  Student's Signature …………………………………                    Date ………………………….

  Supervisor's Signature ……………………………...                    Date ………………………….
