// src/components/crm/ClientTabs.tsx
'use client';

import React, { useState } from 'react';
import { Box, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import TimelineIcon from '@mui/icons-material/Timeline';
import ChatIcon from '@mui/icons-material/Chat';
import { CrmClient, Contact, CrmNote, CrmActivity } from '@/lib/api';

// Import all tab components
const ClientProfile = React.lazy(() => import('./tabs/ClientProfile'));
const ClientTimeline = React.lazy(() => import('./tabs/ClientTimeline'));
const EmbeddedChatView = React.lazy(() => import('./tabs/EmbeddedChatView')); // <-- Import the new component

interface ClientTabsProps {
  client: CrmClient;
  contact: Contact | null;
  notes: CrmNote[];
  activities: CrmActivity[];
}

const TabPanel = (props: { children: React.ReactNode }) => (
  <Box sx={{ py: 3 }}>
    <React.Suspense fallback={ <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}> <CircularProgress /> </Box> }>
      {props.children}
    </React.Suspense>
  </Box>
);

export default function ClientTabs({ client, contact, notes, activities }: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => { setActiveTab(newValue); };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="Client detail tabs">
          <Tab icon={<PersonPinIcon />} iconPosition="start" label="Profile" id="client-tab-0" />
          <Tab icon={<TimelineIcon />} iconPosition="start" label="Timeline & Notes" id="client-tab-1" />
          <Tab icon={<ChatIcon />} iconPosition="start" label="Conversations" id="client-tab-2" disabled={!contact} />
        </Tabs>
      </Box>

      {activeTab === 0 && ( <TabPanel> <ClientProfile client={client} /> </TabPanel> )}
      {activeTab === 1 && ( <TabPanel> <ClientTimeline client={client} notes={notes} activities={activities} /> </TabPanel> )}
      
      {/* --- THIS IS THE FIX --- */}
      {/* Replace the placeholder with the new EmbeddedChatView component */}
      {activeTab === 2 && (
        <TabPanel>
          {contact ? (
            <EmbeddedChatView contact={contact} organizationId={client.organization_id} />
          ) : (
            <Alert severity="info"> This CRM client is not yet linked to a chat contact. </Alert>
          )}
        </TabPanel>
      )}
    </Box>
  );
}