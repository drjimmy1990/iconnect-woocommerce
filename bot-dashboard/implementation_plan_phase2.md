# Phase 2.2: Client 360 Profile View - Implementation Plan

## Goal
Build the **Client 360 Profile View** (`/clients/[id]`) to serve as the central hub for client management, focusing on re-engagement and a unified history view.

## User Review Required
> [!IMPORTANT]
> **Timeline Strategy (Discussion Point)**:
> Instead of re-enabling the `create_activity_from_message` database trigger (which only captures AI messages and bloats the activities table), I propose a **"Virtual Merge"** approach:
> 1. Fetch `crm_activities` (Notes, Calls, Deals).
> 2. Fetch `messages` (User, Agent, AI) separately.
> 3. **Merge them in the UI** based on timestamp.
>
> **Benefits**:
> *   **Performance**: Keeps the `crm_activities` table clean and fast.
> *   **Completeness**: Shows *all* messages (User + AI), not just AI.
> *   **Flexibility**: The "Show Messages" toggle works instantly without database updates.

## Proposed Changes

### 1. Database Schema
*   **No Changes Required**: The existing schema (`crm_clients`, `contacts`, `messages`, `crm_activities`) supports all requirements.

### 2. Components (`src/app/(app)/clients/[id]/components/`)

#### [NEW] `ClientHeader.tsx`
*   **Identity**: Name, Avatar, Status Badge, Last Active.
*   **Actions**:
    *   **Primary**: `Send WhatsApp` (Opens `wa.me`).
    *   **Secondary**: `Open Chat` (Navigates to `/chat` with this client selected).
    *   **Tertiary**: `Send Email`, `Log Call`.

#### [NEW] `ClientSidebar.tsx`
*   **Contact Info**: Phone, Email, Location.
*   **Channel Info**: Platform Name (e.g., "WhatsApp"), Channel Name.
*   **Attributes**: Source, Assigned Agent.
*   **Tags**: Manage tags (add/remove).

#### [NEW] `ClientOverview.tsx` (Default Tab)
*   **Summary Cards**:
    *   `Total Revenue` (LTV)
    *   `Open Deals Value`
    *   `Total Messages` (Count of all interactions)
    *   `Last Contacted` (Color-coded status)
*   **Engagement Chart**: Bar chart of activity volume (messages + activities) over time.

#### [NEW] `ClientTimeline.tsx`
*   **Unified Feed**: Merges `crm_activities` and `messages`.
*   **Controls**:
    *   **"Show Messages" Toggle**: Default `OFF`. When ON, interleaves chat messages into the feed.
    *   **Filters**: Notes, Calls, Deals.
*   **Items**:
    *   **Activity**: Icon, Type, Description, Date, User.
    *   **Message**: Bubble style (User vs Agent), Content Preview, Date.
*   **Add Activity**: Quick input for Notes/Calls.

#### [NEW] `ClientNotes.tsx`
*   **CRUD**: Create, Read, Update, Delete notes.
*   **Features**: Pinning support.

#### [NEW] `ClientDeals.tsx`
*   **List**: Cards showing Deal Name, Stage, Value, Close Date.

### 3. Data Fetching (`src/hooks/`)

#### [MODIFY] `useClient.ts`
*   Update to fetch joined data from `contacts`:
    *   `platform` (Channel)
    *   `unread_count`
    *   `last_message_preview`

#### [NEW] `useClientTimeline.ts`
*   **Function**: Fetches both Activities and Messages.
*   **Logic**:
    *   `useQuery(['client-activities', id])`
    *   `useQuery(['client-messages', id])`
    *   Returns a sorted, merged array: `(Activity | Message)[]`.

#### [NEW] `useClientNotes.ts` & `useClientDeals.ts`
*   Standard CRUD hooks.

## Execution Steps
1.  **Scaffold**: Create the `ClientLayout` and main page structure.
2.  **Data**: Update `useClient` and create `useClientTimeline`.
3.  **Components**: Build Header, Sidebar, and Overview (easiest first).
4.  **Timeline**: Implement the complex merging logic and Toggle.
5.  **Polish**: Add Notes and Deals tabs.
