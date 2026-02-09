// src/modules/productivity-intelligence/routes/dev.js
router.post('/run', async (req, res) => {
  const { organizationId } = req.body;
  const result = await computePrTurnaroundTrend({ organizationId });
  res.json(result);
});
