**UNIVERSITY OF BEDFORDSHIRE**
**DEPARTMENT OF COMPUTER SCIENCE AND TECHNOLOGY**
**FINAL YEAR UG PROJECT**
**WEEKLY PROGRESS REPORT FORM**

Student's Name:    Sayub Shakya    Supervisor's Name:    Pawan KC

Project Title:    EkSamadhan-AI: A SaaS Customer Support Platform with Hybrid AI Human Escalation for E Commerce

Date:        1 October 2026    Report No.:    3


**Summary of progress**

All five items planned last week are done: Google sign-in, the installable app using PWA, agents' availability, the mobile layout, and Jev, a fast decision model, checking each message before the main AI. It was a large week because most of it built on the login, AI and database work finished in weeks 1 and 2. The full list, day by day, is in the repository's commit history.

**Tasks Done:**

1.    **Sign-in and the installable app**: Staff can sign in with Google instead of a new password. The dashboard was made a Progressive Web App (PWA), so it installs on a laptop or phone like a downloaded app. It was tested on a real phone.
2.    **Team availability**: Each person sets Available or Busy and their weekly working hours, and new chats go only to someone who is free. Colleagues see each other's status change at once.
3.    **Smarter AI handling**: Jev reads every message before the main AI. Spam goes to its own tab, and each chat is marked urgent, normal or low priority. If a customer sends the same message twice, they get one answer, and the inbox shows when the AI is typing a reply.
4.    **Settings, channels and privacy**: The owner can rename the business, turn AI replies on or off, and connect Facebook and Instagram pages. Anyone can download their data or delete their account.
5.    **Mobile and design**: Every screen was checked and fixed on phone and tablet sizes. Screens now show a loading animation while data loads, and there is a 404 page for wrong addresses and Privacy Policy and Terms pages.
6.    **Security and testing**: After five wrong passwords in fifteen minutes, the account is locked for a while, so nobody can keep guessing a password. Staff could delete all of the business's chats and connect Facebook pages; now only the owner can delete chats, and only the owner and admins can connect pages. So far there are 118 automated tests, and all of them pass.
7.    **System design**: The system design was redrawn in the five diagram types the supervisor asked for.

**Services and accounts set up:**

1.    **Firebase Authentication**: the project `eksamadhan-ai`, for Sign in with Google.
2.    **Cloudflare tunnel**: a temporary secure web link, so the app running on my laptop can be opened and installed on a phone during development.
3.    **Visual Paradigm**: the Community Edition, for the system design diagrams.

**Changes from the proposal:**

1.    **Availability**: besides Available and Busy, each person's working hours now decide who gets a chat, so nobody is sent chats outside their shift.
2.    **Account deletion**: added to meet GDPR. Deleting removes the person but keeps the business's own record of its chats, with no name attached.


**Plan for next week**

1.    Build the website chat widget and the script a business pastes into its website, with a notification when a reply arrives while the visitor is looking at another tab.
2.    Design a new Home page and update the look of every other page to a modern, consistent style.
3.    Have other people try the app, then give it to a real online business owner; gather their feedback and fix what it shows is missing.
4.    Test the system against the targets set in the proposal: how quickly the AI replies, how often its answers are correct, how quickly staff are alerted, and what share of chats the AI resolves without a person.
5.    Update the final report, complete its missing sections, and keep the Visual Paradigm diagrams in line with the system.


Supervisor's
comments




  Student's Signature …………………………………                    Date ………………………….

  Supervisor's Signature ……………………………...                    Date ………………………….
