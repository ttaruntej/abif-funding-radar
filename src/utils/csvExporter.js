import { isEcosystemSupportOpportunity } from './opportunityFilters';

export const exportToCSV = (
    filteredOpportunities,
    { activeCategory = 'all', activeAudience = 'startup' } = {}
) => {
    const headers = [
        'Name',
        'Provider',
        'Category',
        'Target Audience',
        'Ecosystem Support',
        'Sectors',
        'Stages',
        'Max Award',
        'Deadline',
        'Status',
        'Link'
    ];
    const csvRows = [headers.join(',')];

    filteredOpportunities.forEach((o) => {
        const row = [
            `"${(o.name || '').replace(/"/g, '""')}"`,
            `"${(o.body || '').replace(/"/g, '""')}"`,
            o.category || '',
            `"${(o.targetAudience || []).join(', ')}"`,
            isEcosystemSupportOpportunity(o) ? 'Yes' : 'No',
            `"${(o.sectors || []).join(', ')}"`,
            `"${(o.stages || []).join(', ')}"`,
            `"${(o.maxAward || '').replace(/"/g, '""')}"`,
            `"${(o.deadline || '').replace(/"/g, '""')}"`,
            o.status || '',
            `"${o.link || ''}"`
        ];
        csvRows.push(row.join(','));
    });

    const exportTag = activeCategory === 'ecosystem' ? 'ecosystem_support' : 'funding_export';
    const audienceTag = activeAudience === 'incubator' ? 'incubator' : activeAudience === 'all' ? 'all_audience' : 'startup';
    const filename = `abif_${audienceTag}_${exportTag}_${new Date().toISOString().split('T')[0]}.csv`;

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};
