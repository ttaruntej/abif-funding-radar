export const exportToCSV = (filteredOpportunities) => {
    const headers = ['Name', 'Provider', 'Category', 'Target Audience', 'Sectors', 'Stages', 'Max Award', 'Deadline', 'Status', 'Link'];
    const csvRows = [headers.join(',')];

    filteredOpportunities.forEach(o => {
        const row = [
            `"${(o.name || '').replace(/"/g, '""')}"`,
            `"${(o.body || '').replace(/"/g, '""')}"`,
            o.category || '',
            `"${(o.targetAudience || []).join(', ')}"`,
            `"${(o.sectors || []).join(', ')}"`,
            `"${(o.stages || []).join(', ')}"`,
            `"${(o.maxAward || '').replace(/"/g, '""')}"`,
            `"${(o.deadline || '').replace(/"/g, '""')}"`,
            o.status || '',
            `"${o.link || ''}"`
        ];
        csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `abif_funding_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};
