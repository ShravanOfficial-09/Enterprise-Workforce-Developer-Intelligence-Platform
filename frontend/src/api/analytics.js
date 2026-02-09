import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || ''
});

export const fetchOrgOverview = async ({ organizationId, metricKey, windowValue, windowUnit, asOf }) => {
  const response = await api.get('/analytics/org-overview', {
    params: {
      organizationId,
      metricKey,
      windowValue,
      windowUnit,
      asOf
    }
  });

  return response.data?.data;
};
