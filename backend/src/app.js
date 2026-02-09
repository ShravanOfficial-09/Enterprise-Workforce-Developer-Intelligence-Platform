const express = require('express');
const cors = require('cors');

const orgAnalyticsRoutes = require('./modules/analytics/routes/orgAnalytics');
const devAnalyticsRoutes = require('./modules/analytics/routes/devAnalytics');
const burnoutRiskRoutes = require('./modules/burnout-risk/routes/burnoutRisk');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/analytics', orgAnalyticsRoutes);
app.use('/analytics/dev', devAnalyticsRoutes);
app.use('/burnout-risk', burnoutRiskRoutes);

module.exports = app;
