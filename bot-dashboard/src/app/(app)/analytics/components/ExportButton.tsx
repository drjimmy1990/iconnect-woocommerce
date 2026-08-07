'use client';

import React from 'react';
import { Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DashboardSummary, ChannelPerformance } from '@/hooks/useAnalytics';

interface ExportButtonProps {
    summary?: DashboardSummary;
    channelPerformance?: ChannelPerformance[];
}

export default function ExportButton({ summary, channelPerformance }: ExportButtonProps) {
    const handleExport = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.text('Analytics Report', 14, 22);
        doc.setFontSize(11);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        // Summary Section
        doc.setFontSize(14);
        doc.text('Business Overview', 14, 45);

        if (summary) {
            const summaryData = [
                ['Metric', 'Value'],
                ['Total Revenue', `EGP ${summary.total_revenue}`],
                ['New Clients', `${summary.total_leads}`],
                ['Avg Order Value', `EGP ${summary.avg_order_value}`],
                ['Pending Activities', `${summary.pending_activities}`],
                ['Total Clients', `${summary.total_clients}`],
                ['Total Customers', `${summary.total_customers}`],
            ];

            autoTable(doc, {
                startY: 50,
                head: [summaryData[0]],
                body: summaryData.slice(1),
            });
        }

        // Channel Performance Section
        if (channelPerformance && channelPerformance.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const finalY = (doc as any).lastAutoTable.finalY || 50;
            doc.text('Channel Performance', 14, finalY + 15);

            const channelData = channelPerformance.map(ch => [
                ch.channel_name,
                ch.platform,
                ch.total_messages,
                ch.incoming_messages,
                ch.agent_responses,
                ch.ai_responses
            ]);

            autoTable(doc, {
                startY: finalY + 20,
                head: [['Channel', 'Platform', 'Total Msgs', 'Incoming', 'Agent', 'AI']],
                body: channelData,
            });
        }

        doc.save('analytics-report.pdf');
    };

    return (
        <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
        >
            Export Report
        </Button>
    );
}
