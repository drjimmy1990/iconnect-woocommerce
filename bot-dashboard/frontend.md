# Frontend Documentation & Metrics Guide

This document details the various sections of the Dashboard, explaining what data is shown, how it is calculated, and the purpose of each component.

## 1. Analytics Dashboard (`/analytics`)

The Analytics Dashboard is the command center for tracking business health and bot performance. It is divided into several key sections.

### A. Business Overview (Summary Cards)
Located at the top of the dashboard, these cards provide an instant snapshot of key KPIs.

| Metric | Description | Data Source |
| :--- | :--- | :--- |
| **Total Revenue** | The sum of all *delivered* orders. Does not include cancelled or refunded orders. | `crm_orders` (status = 'delivered') |
| **Active Leads** | The total number of clients currently in the 'lead' lifecycle stage. | `crm_clients` (lifecycle_stage = 'lead') |
| **Open Deals Value** | The total potential revenue from all deals that are currently *open* (not won or lost). | `crm_deals` (stage NOT IN 'closed_won', 'closed_lost') |
| **Pending Activities** | The number of tasks, calls, or meetings that are scheduled but not yet marked as completed. | `crm_activities` (status = 'pending') |

### B. Revenue Analytics
A visual breakdown of financial performance over time.

*   **Chart Type**: Area Chart / Bar Chart.
*   **X-Axis**: Time period (Day, Week, or Month).
*   **Y-Axis**: Revenue ($).
*   **What it shows**:
    *   **Total Revenue**: Daily/Weekly sales volume.
    *   **Order Count**: Number of transactions per period.
    *   **Avg Order Value**: How much the average customer spends per transaction.
*   **Purpose**: Identify sales trends, seasonal spikes, or revenue dips.

### C. Conversion Funnel
A funnel chart visualizing the customer journey from initial contact to loyal evangelist.

*   **Stages**:
    1.  **Lead**: Initial contact or inquiry.
    2.  **MQL (Marketing Qualified Lead)**: Engaged lead (e.g., visited pricing page).
    3.  **SQL (Sales Qualified Lead)**: Ready for sales contact.
    4.  **Opportunity**: Active deal in negotiation.
    5.  **Customer**: Has made a purchase.
    6.  **Evangelist**: Loyal repeat customer/promoter.
*   **What it shows**: The number of clients at each stage and the *conversion rate* (percentage) from one stage to the next.
*   **Purpose**: Identify bottlenecks. (e.g., If you have 1000 Leads but only 10 MQLs, your initial engagement strategy needs work).

### D. Deal Analytics
Insights into the sales pipeline and deal closure rates.

*   **Pipeline Value by Stage**: Bar chart showing the total dollar value locked in each stage (Prospecting vs. Negotiation vs. Proposal).
*   **Win/Loss Rate**: Pie chart showing the percentage of deals Won vs. Lost.
*   **Average Deal Size**: The average value of closed-won deals.
*   **Purpose**: Helps sales managers forecast revenue and assess team performance.

### E. Channel Performance
Metrics on how different communication channels (WhatsApp, Web, Messenger) are performing.

*   **Metrics**:
    *   **Total Traffic**: Total messages exchanged.
    *   **Response Distribution**:
        *   **AI Responses**: % of messages handled automatically by the bot.
        *   **Agent Responses**: % of messages requiring human intervention.
*   **Purpose**: Evaluate which channels are busiest and how effectively the AI is deflecting workload from human agents.

### F. Chatbot Effectiveness
Specific metrics on the AI's performance.

*   **Resolution Rate**: Percentage of conversations handled entirely by AI without agent takeover.
*   **Avg Response Time**: How quickly the bot replies (usually < 1s).
*   **Sentiment Analysis**: (Future Feature) The general mood of users interacting with the bot.

---

## 2. Client List (`/clients`)

The central database of all contacts and customers.

### A. Data Grid Columns
*   **Company / Name**: The client's display name and their unique ID.
*   **Status**: The lifecycle stage (Lead, Customer, etc.). Color-coded for quick scanning.
*   **Type**: The relationship type (Prospect, Partner, etc.).
*   **Last Contact**: Timestamp of the last interaction (message, call, or email).
*   **Revenue**: Total lifetime value (LTV) of the client.
*   **Tags**: Custom labels (e.g., "VIP", "Urgent") for quick categorization.

### B. Filters
*   **Search**: Text search by name, email, or ID.
*   **Status Filter**: Show only "Leads" or "Customers".
*   **Tag Filter**: Show only clients with specific tags (e.g., "VIP").
*   **Agent Filter**: Show clients assigned to a specific team member.

### C. Bulk Actions
Actions you can perform on multiple selected clients at once:
*   **Assign Agent**: Transfer ownership of 50 leads to a sales rep.
*   **Add Tags**: Mark a group of clients as "Conference Attendees".
*   **Delete**: Remove test data or obsolete records.

---

## 3. Chat Interface (`/chat`)

The live communication hub.

*   **Sidebar**: List of active conversations, sorted by most recent message. Shows unread badges.
*   **Chat Window**: Real-time message history.
    *   **AI Handoff**: Button to pause the AI and take over manually.
    *   **Quick Replies**: Pre-saved responses for common questions.
    *   **Attachments**: Send files/images.
*   **Right Panel (Context)**: Shows the current contact's CRM details (Name, Email, Deal Stage) so the agent has context while chatting.

---

## 4. Channel Management (`/channels`)

Configuration for external platforms.

*   **Channel List**: Active connections (e.g., "Official WhatsApp", "Website Widget").
*   **Status**: Online/Offline indicator.
*   **Configuration**:
    *   **AI Settings**: Choose the model (Gemini/GPT), set "Temperature" (creativity), and customize the System Prompt (bot personality).
    *   **Credentials**: API keys and secrets for the platform.
