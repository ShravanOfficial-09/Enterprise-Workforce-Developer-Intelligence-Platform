const AuditLog = require('../models/AuditLog');

// AuditLog is append-only. This service intentionally exposes create-only helpers.

const create = async ({
  organizationId,
  actorId,
  eventType,
  ruleId,
  signalId,
  context,
  occurredAt,
  correlationId
}) => AuditLog.create({
  organizationId,
  actorId,
  eventType,
  ruleId,
  signalId,
  context,
  occurredAt,
  correlationId
});

const logRuleEvaluation = async ({
  organizationId,
  actorId,
  ruleId,
  signalId,
  context,
  occurredAt,
  correlationId
}) => create({
  organizationId,
  actorId,
  eventType: 'COMPLIANCE_RULE_EVALUATED',
  ruleId,
  signalId,
  context,
  occurredAt,
  correlationId
});

const logSignalCreated = async ({
  organizationId,
  actorId,
  ruleId,
  signalId,
  context,
  occurredAt,
  correlationId
}) => create({
  organizationId,
  actorId,
  eventType: 'COMPLIANCE_SIGNAL_CREATED',
  ruleId,
  signalId,
  context,
  occurredAt,
  correlationId
});

module.exports = {
  create,
  logRuleEvaluation,
  logSignalCreated
};
